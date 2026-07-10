"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { requireRole } from "@/lib/auth"
import {
  addDays,
  dateKeyAtMinutes,
  dateKeyToDatabaseDate,
  enumerateDateKeys,
  getDateKeyWeekday,
  timeToMinutes,
} from "@/lib/dates"
import { requireOwnedGroup } from "@/lib/groups"
import { prisma } from "@/lib/prisma"

export type AdminActionState = {
  message?: string
  success?: boolean
  errors?: Record<string, string[] | undefined>
}

const datePattern = /^\d{4}-\d{2}-\d{2}$/
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/

const planSchema = z.object({
  groupId: z.string().uuid("请选择小组"),
  title: z.string().trim().min(2, "规则名称至少需要 2 个字符").max(120),
  description: z.string().trim().max(1000).optional(),
  startDate: z.string().regex(datePattern, "请选择开始日期"),
  endDate: z.string().regex(datePattern, "请选择结束日期"),
  openTime: z.string().regex(timePattern, "请选择开放时间"),
  dueTime: z.string().regex(timePattern, "请选择截止时间"),
  requiredImageCount: z.coerce.number().int().min(1, "至少需要 1 张图片").max(20),
  maxImageCount: z.coerce.number().int().min(1).max(30),
  allowMakeup: z.string().optional(),
  makeupDays: z.coerce.number().int().min(0).max(30),
})

export async function addAdminMember(groupId: string, formData: FormData) {
  const { user: actor, group } = await requireOwnedGroup(groupId)
  const userId = z.string().uuid().safeParse(formData.get("userId"))
  if (!userId.success) return

  const target = await prisma.user.findUnique({ where: { id: userId.data } })
  if (!target || target.status !== "ACTIVE") return

  const canAdd = target.role === "USER" || target.id === group.ownerAdminId
  if (!canAdd) return

  await prisma.$transaction(async (tx) => {
    await tx.groupMember.create({
      data: { groupId, userId: target.id, participatesInCheckIn: true },
    })
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "ADMIN_GROUP_MEMBER_ADDED",
        entityType: "Group",
        entityId: groupId,
        summary: `管理员将 ${target.username} 加入小组 ${group.name}`,
      },
    })
  })

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/members")
}

export async function removeAdminMember(groupId: string, userId: string) {
  const { user: actor, group } = await requireOwnedGroup(groupId)
  const membership = await prisma.groupMember.findUnique({
    where: { userId },
    include: { user: true },
  })

  if (!membership || membership.groupId !== groupId) return

  await prisma.$transaction(async (tx) => {
    await tx.groupMember.delete({ where: { id: membership.id } })
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "ADMIN_GROUP_MEMBER_REMOVED",
        entityType: "Group",
        entityId: groupId,
        summary: `管理员将 ${membership.user.username} 移出小组 ${group.name}`,
      },
    })
  })

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/members")
}

export async function createCheckInPlan(
  _state: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  const actor = await requireRole(["ROOT", "ADMIN"])
  const parsed = planSchema.safeParse(Object.fromEntries(formData))
  const weekdays = formData
    .getAll("weekdays")
    .map(Number)
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)

  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors }
  if (!weekdays.length) return { errors: { weekdays: ["至少选择一个打卡日"] } }

  const { group } = await requireOwnedGroup(parsed.data.groupId)
  const openMinutes = timeToMinutes(parsed.data.openTime)
  const dueMinutes = timeToMinutes(parsed.data.dueTime)

  if (parsed.data.endDate < parsed.data.startDate) {
    return { errors: { endDate: ["结束日期不能早于开始日期"] } }
  }
  if (enumerateDateKeys(parsed.data.startDate, parsed.data.endDate).length > 366) {
    return { message: "单个打卡规则最长支持 366 天。" }
  }
  if (dueMinutes <= openMinutes) {
    return { errors: { dueTime: ["截止时间必须晚于开放时间"] } }
  }
  if (parsed.data.maxImageCount < parsed.data.requiredImageCount) {
    return { errors: { maxImageCount: ["最多图片数不能少于必交图片数"] } }
  }

  const allowMakeup = parsed.data.allowMakeup === "on"
  const makeupDays = allowMakeup ? parsed.data.makeupDays : 0
  if (allowMakeup && makeupDays < 1) {
    return { errors: { makeupDays: ["允许补卡时，补卡天数至少为 1 天"] } }
  }

  const matchingDates = enumerateDateKeys(parsed.data.startDate, parsed.data.endDate)
    .filter((dateKey) => weekdays.includes(getDateKeyWeekday(dateKey)))

  if (!matchingDates.length) {
    return { message: "当前日期范围内没有匹配的打卡日。" }
  }

  await prisma.$transaction(async (tx) => {
    const plan = await tx.checkInPlan.create({
      data: {
        groupId: group.id,
        title: parsed.data.title,
        description: parsed.data.description || null,
        status: "ACTIVE",
        startDate: dateKeyToDatabaseDate(parsed.data.startDate),
        endDate: dateKeyToDatabaseDate(parsed.data.endDate),
        weekdays,
        openTimeMinutes: openMinutes,
        dueTimeMinutes: dueMinutes,
        requiredImageCount: parsed.data.requiredImageCount,
        maxImageCount: parsed.data.maxImageCount,
        allowMakeup,
        makeupDays,
      },
    })

    await tx.checkInOccurrence.createMany({
      data: matchingDates.map((dateKey) => {
        const dueAt = dateKeyAtMinutes(dateKey, dueMinutes)
        return {
          planId: plan.id,
          checkInDate: dateKeyToDatabaseDate(dateKey),
          opensAt: dateKeyAtMinutes(dateKey, openMinutes),
          dueAt,
          makeupUntil: allowMakeup ? addDays(dueAt, makeupDays) : null,
          requiredImageCount: parsed.data.requiredImageCount,
          maxImageCount: parsed.data.maxImageCount,
        }
      }),
    })

    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "CHECK_IN_PLAN_CREATED",
        entityType: "CheckInPlan",
        entityId: plan.id,
        summary: `为小组 ${group.name} 创建规则 ${plan.title}，生成 ${matchingDates.length} 个打卡任务`,
      },
    })
  })

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/rules")
  revalidatePath("/dashboard/submissions")
  return { success: true, message: `规则已启用，共生成 ${matchingDates.length} 个每日打卡任务。` }
}

export async function toggleCheckInPlan(planId: string) {
  await requireRole(["ROOT", "ADMIN"])
  const plan = await prisma.checkInPlan.findUnique({
    where: { id: planId },
    include: { group: true },
  })
  if (!plan || !["ACTIVE", "PAUSED"].includes(plan.status)) return

  const { user } = await requireOwnedGroup(plan.groupId)
  const nextStatus = plan.status === "ACTIVE" ? "PAUSED" : "ACTIVE"

  await prisma.$transaction(async (tx) => {
    await tx.checkInPlan.update({ where: { id: plan.id }, data: { status: nextStatus } })
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: nextStatus === "ACTIVE" ? "CHECK_IN_PLAN_RESUMED" : "CHECK_IN_PLAN_PAUSED",
        entityType: "CheckInPlan",
        entityId: plan.id,
        summary: `${nextStatus === "ACTIVE" ? "启用" : "暂停"}打卡规则 ${plan.title}`,
      },
    })
  })

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/rules")
}

export async function archiveCheckInPlan(planId: string) {
  const plan = await prisma.checkInPlan.findUnique({
    where: { id: planId },
    include: { group: true },
  })
  if (!plan || plan.status === "ARCHIVED") return

  const { user } = await requireOwnedGroup(plan.groupId)
  const now = new Date()

  await prisma.$transaction(async (tx) => {
    await tx.checkInPlan.update({ where: { id: plan.id }, data: { status: "ARCHIVED" } })
    await tx.checkInOccurrence.updateMany({
      where: {
        planId: plan.id,
        opensAt: { gt: now },
        submissions: { none: {} },
      },
      data: { status: "CANCELLED" },
    })
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: "CHECK_IN_PLAN_ARCHIVED",
        entityType: "CheckInPlan",
        entityId: plan.id,
        summary: `归档打卡规则 ${plan.title}`,
      },
    })
  })

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/rules")
  revalidatePath("/dashboard/check-in")
  revalidatePath("/dashboard/submissions")
}

export async function returnSubmission(submissionId: string, formData: FormData) {
  const actor = await requireRole(["ROOT", "ADMIN"])
  const reviewNote = z.string().trim().min(2, "请填写退回原因").max(500).safeParse(formData.get("reviewNote"))
  if (!reviewNote.success) return

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { user: true, occurrence: { include: { plan: { include: { group: true } } } } },
  })
  if (!submission || !["SUBMITTED", "MAKEUP"].includes(submission.status)) return

  const canReview = actor.role === "ROOT" || submission.occurrence.plan.group.ownerAdminId === actor.id
  if (!canReview) return

  await prisma.$transaction(async (tx) => {
    await tx.submission.update({
      where: { id: submission.id },
      data: {
        status: "DRAFT",
        submittedAt: null,
        reviewNote: reviewNote.data,
        returnedAt: new Date(),
        returnedFromStatus: submission.status,
      },
    })
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "SUBMISSION_RETURNED",
        entityType: "Submission",
        entityId: submission.id,
        summary: `退回 ${submission.user.username} 的作业：${reviewNote.data}`,
      },
    })
  })

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/submissions")
  revalidatePath(`/dashboard/submissions/${submission.id}`)
  revalidatePath("/dashboard/check-in")
  redirect(`/dashboard/submissions/${submission.id}`)
}
