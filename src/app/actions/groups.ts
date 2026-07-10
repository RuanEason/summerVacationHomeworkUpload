"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { Prisma } from "@/generated/prisma/client"
import { requireRole } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export type GroupActionState = {
  message?: string
  success?: boolean
  errors?: Record<string, string[] | undefined>
}

const groupSchema = z.object({
  name: z.string().trim().min(2, "小组名称至少需要 2 个字符").max(100),
  description: z.string().trim().max(255).optional(),
  ownerAdminId: z.string().uuid("请选择管理员"),
  ownerParticipates: z.string().optional(),
})

export async function createGroup(
  _state: GroupActionState,
  formData: FormData
): Promise<GroupActionState> {
  const actor = await requireRole(["ROOT"])
  const parsed = groupSchema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors }

  const admin = await prisma.user.findUnique({ where: { id: parsed.data.ownerAdminId } })
  if (!admin || admin.role !== "ADMIN" || admin.status !== "ACTIVE") {
    return { message: "所选管理员不存在或尚未激活。" }
  }

  try {
    const group = await prisma.$transaction(async (tx) => {
      const created = await tx.group.create({
        data: {
          name: parsed.data.name,
          description: parsed.data.description || null,
          ownerAdminId: admin.id,
        },
      })

      if (parsed.data.ownerParticipates === "on") {
        await tx.groupMember.create({
          data: { groupId: created.id, userId: admin.id },
        })
      }

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "GROUP_CREATED",
          entityType: "Group",
          entityId: created.id,
          summary: `创建小组 ${created.name}，管理员为 ${admin.username}`,
        },
      })

      return created
    })

    revalidatePath("/dashboard/groups")
    return { success: true, message: `小组 ${group.name} 已创建。` }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { message: "该管理员已经属于其他小组，无法设置为打卡成员。" }
    }
    return { message: "创建小组失败，请稍后重试。" }
  }
}

export async function addGroupMember(groupId: string, formData: FormData) {
  const actor = await requireRole(["ROOT"])
  const userId = z.string().uuid().safeParse(formData.get("userId"))
  if (!userId.success) return

  const [group, user] = await Promise.all([
    prisma.group.findUnique({ where: { id: groupId } }),
    prisma.user.findUnique({ where: { id: userId.data } }),
  ])

  if (!group || !user || user.role === "ROOT" || user.status !== "ACTIVE") return

  await prisma.$transaction(async (tx) => {
    await tx.groupMember.create({
      data: { groupId, userId: user.id, participatesInCheckIn: true },
    })
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "GROUP_MEMBER_ADDED",
        entityType: "Group",
        entityId: groupId,
        summary: `将 ${user.username} 加入小组 ${group.name}`,
      },
    })
  })

  revalidatePath(`/dashboard/groups/${groupId}`)
  revalidatePath("/dashboard/groups")
}

export async function removeGroupMember(groupId: string, userId: string) {
  const actor = await requireRole(["ROOT"])
  const membership = await prisma.groupMember.findUnique({
    where: { userId },
    include: { user: true, group: true },
  })

  if (!membership || membership.groupId !== groupId) return

  await prisma.$transaction(async (tx) => {
    await tx.groupMember.delete({ where: { id: membership.id } })
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "GROUP_MEMBER_REMOVED",
        entityType: "Group",
        entityId: groupId,
        summary: `将 ${membership.user.username} 移出小组 ${membership.group.name}`,
      },
    })
  })

  revalidatePath(`/dashboard/groups/${groupId}`)
  revalidatePath("/dashboard/groups")
}
