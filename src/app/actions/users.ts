"use server"

import { hash } from "bcryptjs"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { Prisma } from "@/generated/prisma/client"
import { requireRole } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createSession } from "@/lib/session"
import { createOpaqueToken, hashOpaqueToken } from "@/lib/tokens"

export type UserActionState = {
  message?: string
  success?: boolean
  activationPath?: string
  errors?: Record<string, string[] | undefined>
}

const baseUserSchema = z.object({
  displayName: z.string().trim().min(2, "姓名至少需要 2 个字符").max(80),
  username: z
    .string()
    .trim()
    .min(3, "用户名至少需要 3 个字符")
    .max(64)
    .regex(/^[a-zA-Z0-9_.-]+$/, "仅支持字母、数字、点、下划线和短横线"),
  role: z.enum(["ADMIN", "USER"], { error: "请选择有效角色" }),
})

const directUserSchema = baseUserSchema.extend({
  password: z.string().min(8, "密码至少需要 8 个字符").max(72),
  mustChangePassword: z.string().optional(),
})

const activateSchema = z
  .object({
    token: z.string().min(20),
    password: z.string().min(8, "密码至少需要 8 个字符").max(72),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "两次输入的密码不一致",
    path: ["confirmPassword"],
  })

function userWriteError(error: unknown): UserActionState {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return { message: "用户名已经存在，请换一个用户名。" }
  }

  return { message: "操作失败，请稍后重试。" }
}

export async function createDirectUser(
  _state: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  const actor = await requireRole(["ROOT"])
  const parsed = directUserSchema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  const { displayName, username, role, password, mustChangePassword } = parsed.data

  try {
    const passwordHash = await hash(password, 12)

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          displayName,
          username,
          role,
          passwordHash,
          status: "ACTIVE",
          mustChangePassword: mustChangePassword === "on",
          createdById: actor.id,
        },
      })

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "USER_CREATED_DIRECTLY",
          entityType: "User",
          entityId: user.id,
          summary: `直接创建${role === "ADMIN" ? "管理员" : "普通用户"} ${username}`,
        },
      })
    })
  } catch (error) {
    return userWriteError(error)
  }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/users")
  return { success: true, message: `用户 ${displayName} 已创建，可以直接登录。` }
}

export async function createInvitedUser(
  _state: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  const actor = await requireRole(["ROOT"])
  const parsed = baseUserSchema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  const { displayName, username, role } = parsed.data
  const token = createOpaqueToken()

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          displayName,
          username,
          role,
          status: "PENDING",
          createdById: actor.id,
        },
      })

      await tx.invitation.create({
        data: {
          userId: user.id,
          tokenHash: hashOpaqueToken(token),
          expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
        },
      })

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "USER_INVITED",
          entityType: "User",
          entityId: user.id,
          summary: `预创建${role === "ADMIN" ? "管理员" : "普通用户"} ${username}`,
        },
      })
    })
  } catch (error) {
    return userWriteError(error)
  }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/users")
  return {
    success: true,
    message: `已为 ${displayName} 生成激活链接，有效期 72 小时。`,
    activationPath: `/activate/${token}`,
  }
}

export async function activateUser(
  _state: UserActionState,
  formData: FormData
): Promise<UserActionState> {
  const parsed = activateSchema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  const tokenHash = hashOpaqueToken(parsed.data.token)
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash },
    include: { user: true },
  })

  if (
    !invitation ||
    invitation.status !== "PENDING" ||
    invitation.expiresAt <= new Date() ||
    invitation.user.status !== "PENDING"
  ) {
    return { message: "激活链接无效、已经使用或已过期。" }
  }

  const passwordHash = await hash(parsed.data.password, 12)

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: invitation.userId },
      data: {
        passwordHash,
        status: "ACTIVE",
        mustChangePassword: false,
      },
    })
    await tx.invitation.update({
      where: { id: invitation.id },
      data: { status: "USED", usedAt: new Date() },
    })
    await tx.auditLog.create({
      data: {
        actorId: invitation.userId,
        action: "USER_ACTIVATED",
        entityType: "User",
        entityId: invitation.userId,
        summary: `用户 ${invitation.user.username} 完成账号激活`,
      },
    })
  })

  await createSession(invitation.userId)
  redirect("/dashboard")
}

export async function toggleUserStatus(userId: string) {
  const actor = await requireRole(["ROOT"])

  if (actor.id === userId) return

  const target = await prisma.user.findUnique({ where: { id: userId } })
  if (!target || target.role === "ROOT" || target.status === "PENDING") return

  const nextStatus = target.status === "ACTIVE" ? "DISABLED" : "ACTIVE"

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { status: nextStatus } })

    if (nextStatus === "DISABLED") {
      await tx.session.deleteMany({ where: { userId } })
    }

    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: nextStatus === "ACTIVE" ? "USER_ENABLED" : "USER_DISABLED",
        entityType: "User",
        entityId: userId,
        summary: `${nextStatus === "ACTIVE" ? "启用" : "停用"}用户 ${target.username}`,
      },
    })
  })

  revalidatePath("/dashboard/users")
}

export async function deletePendingUser(userId: string) {
  const actor = await requireRole(["ROOT"])
  const target = await prisma.user.findUnique({ where: { id: userId } })

  if (!target || target.role === "ROOT" || target.status !== "PENDING") return

  await prisma.$transaction(async (tx) => {
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "PENDING_USER_DELETED",
        entityType: "User",
        entityId: userId,
        summary: `删除待激活用户 ${target.username}`,
      },
    })
    await tx.user.delete({ where: { id: userId } })
  })

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/users")
}
