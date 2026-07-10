"use server"

import { compare, hash } from "bcryptjs"
import { redirect } from "next/navigation"
import { z } from "zod"

import { requireUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { createSession, deleteCurrentSession } from "@/lib/session"

export type AuthActionState = {
  message?: string
  errors?: Record<string, string[] | undefined>
}

const setupSchema = z
  .object({
    systemName: z.string().trim().min(2, "系统名称至少需要 2 个字符").max(100),
    displayName: z.string().trim().min(2, "姓名至少需要 2 个字符").max(80),
    username: z
      .string()
      .trim()
      .min(3, "用户名至少需要 3 个字符")
      .max(64)
      .regex(/^[a-zA-Z0-9_.-]+$/, "仅支持字母、数字、点、下划线和短横线"),
    password: z.string().min(8, "密码至少需要 8 个字符").max(72),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "两次输入的密码不一致",
    path: ["confirmPassword"],
  })

const loginSchema = z.object({
  username: z.string().trim().min(1, "请输入用户名"),
  password: z.string().min(1, "请输入密码"),
})

const changePasswordSchema = z
  .object({
    password: z.string().min(8, "密码至少需要 8 个字符").max(72),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "两次输入的密码不一致",
    path: ["confirmPassword"],
  })

export async function initializeSystem(
  _state: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = setupSchema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  const existingConfig = await prisma.systemConfig.findUnique({ where: { id: 1 } })

  if (existingConfig) {
    return { message: "系统已经完成初始化，请直接登录。" }
  }

  const { systemName, displayName, username, password } = parsed.data
  const passwordHash = await hash(password, 12)

  try {
    const root = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username,
          displayName,
          passwordHash,
          role: "ROOT",
          status: "ACTIVE",
        },
      })

      await tx.systemConfig.create({
        data: {
          id: 1,
          systemName,
          timezone: "Asia/Shanghai",
          rootUserId: user.id,
        },
      })

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "SYSTEM_INITIALIZED",
          entityType: "SystemConfig",
          entityId: "1",
          summary: `初始化系统并创建 ROOT 用户 ${username}`,
        },
      })

      return user
    })

    await createSession(root.id)
  } catch {
    return {
      message: "初始化失败。系统可能已经被初始化，或用户名已被使用。",
    }
  }

  redirect("/dashboard")
}

export async function changeInitialPassword(
  _state: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const user = await requireUser()
  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  const passwordHash = await hash(parsed.data.password, 12)

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false },
    })
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "INITIAL_PASSWORD_CHANGED",
        entityType: "User",
        entityId: user.id,
        summary: `用户 ${user.username} 修改初始密码`,
      },
    })
  })

  redirect("/dashboard")
}

export async function login(
  _state: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  const user = await prisma.user.findUnique({
    where: { username: parsed.data.username },
  })

  if (!user?.passwordHash || !(await compare(parsed.data.password, user.passwordHash))) {
    return { message: "用户名或密码错误。" }
  }

  if (user.status === "PENDING") {
    return { message: "账号尚未激活，请使用管理员发送的激活链接。" }
  }

  if (user.status === "DISABLED") {
    return { message: "账号已被停用，请联系管理员。" }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  })
  await createSession(user.id)

  redirect(user.mustChangePassword ? "/change-password" : "/dashboard")
}

export async function logout() {
  await deleteCurrentSession()
  redirect("/login")
}
