"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireRole } from "@/lib/auth"
import { getCheckInAvailableAt } from "@/lib/check-in-window"
import { prisma } from "@/lib/prisma"

export type CheckInActionState = {
  message?: string
  success?: boolean
}

const submitSchema = z.object({
  occurrenceId: z.string().uuid(),
  note: z.string().trim().max(500, "备注不能超过 500 个字符").optional(),
})

export async function submitCheckIn(
  _state: CheckInActionState,
  formData: FormData
): Promise<CheckInActionState> {
  const user = await requireRole(["ADMIN", "USER"])
  const parsed = submitSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "提交参数无效。" }

  const occurrence = await prisma.checkInOccurrence.findUnique({
    where: { id: parsed.data.occurrenceId },
    include: { plan: true },
  })
  if (!occurrence || occurrence.plan.status !== "ACTIVE") {
    return { message: "打卡任务不存在或规则已暂停。" }
  }

  const membership = await prisma.groupMember.findUnique({ where: { userId: user.id } })
  if (!membership || membership.groupId !== occurrence.plan.groupId || !membership.participatesInCheckIn) {
    return { message: "你不是该任务的打卡成员。" }
  }

  const submission = await prisma.submission.findUnique({
    where: { occurrenceId_userId: { occurrenceId: occurrence.id, userId: user.id } },
    include: { _count: { select: { images: true } } },
  })
  if (!submission || submission.status !== "DRAFT") {
    return { message: submission ? "该任务已经提交。" : "请先上传作业图片。" }
  }
  if (submission._count.images < occurrence.requiredImageCount) {
    return { message: `至少需要上传 ${occurrence.requiredImageCount} 张图片。` }
  }
  if (submission._count.images > occurrence.maxImageCount) {
    return { message: `最多只能上传 ${occurrence.maxImageCount} 张图片。` }
  }

  const now = new Date()
  let status: "SUBMITTED" | "MAKEUP"
  const availableAt = getCheckInAvailableAt(occurrence.opensAt, occurrence.plan)
  const isReturned = Boolean(submission.returnedAt && submission.returnedFromStatus)
  if (isReturned) {
    status = submission.returnedFromStatus === "MAKEUP" ? "MAKEUP" : "SUBMITTED"
  } else if (now < availableAt) return { message: "打卡尚未开始。" }
  else if (now <= occurrence.dueAt) {
    status = "SUBMITTED"
  } else if (occurrence.makeupUntil && now <= occurrence.makeupUntil) {
    status = "MAKEUP"
  } else {
    return { message: "打卡和补卡时间均已结束。" }
  }

  const isEarlySubmission = status === "SUBMITTED" && now < occurrence.opensAt

  const committed = await prisma.$transaction(async (tx) => {
    const updated = await tx.submission.updateMany({
      where: { id: submission.id, status: "DRAFT" },
      data: {
        status,
        note: parsed.data.note || null,
        reviewNote: null,
        returnedAt: null,
        returnedFromStatus: null,
        submittedAt: now,
      },
    })
    if (updated.count !== 1) return false

    await tx.auditLog.create({
      data: {
        actorId: user.id,
        action: status === "MAKEUP" ? "CHECK_IN_MAKEUP_SUBMITTED" : isEarlySubmission ? "CHECK_IN_EARLY_SUBMITTED" : "CHECK_IN_SUBMITTED",
        entityType: "Submission",
        entityId: submission.id,
        summary: `${user.username} 提交 ${occurrence.plan.title}${status === "MAKEUP" ? "（补卡）" : isEarlySubmission ? "（提前打卡）" : ""}`,
      },
    })
    return true
  })

  if (!committed) return { message: "该任务已经提交，请勿重复操作。" }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/check-in")
  revalidatePath("/dashboard/history")
  revalidatePath("/dashboard/submissions")
  return { success: true, message: status === "MAKEUP" ? "补卡提交成功。" : isEarlySubmission ? "提前打卡提交成功。" : "今日打卡成功。" }
}
