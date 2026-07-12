import "server-only"

import { addDays } from "@/lib/dates"
import { getCheckInAvailableAt, MAX_EARLY_CHECK_IN_DAYS } from "@/lib/check-in-window"
import { prisma } from "@/lib/prisma"
import { cosUploadUrl } from "@/lib/uploads"

export async function getAvailableCheckInTasks(userId: string) {
  const now = new Date()
  const futureOpenLimit = addDays(now, MAX_EARLY_CHECK_IN_DAYS)
  const occurrences = await prisma.checkInOccurrence.findMany({
    where: {
      plan: {
        status: "ACTIVE",
        group: {
          members: { some: { userId, participatesInCheckIn: true } },
        },
      },
      OR: [
        { dueAt: { gte: now }, opensAt: { lte: futureOpenLimit } },
        { dueAt: { lt: now }, makeupUntil: { gte: now } },
        {
          submissions: {
            some: {
              userId,
              status: "DRAFT",
              returnedAt: { not: null },
            },
          },
        },
      ],
    },
    orderBy: { checkInDate: "asc" },
    include: {
      plan: { include: { group: true } },
      submissions: {
        where: { userId },
        include: { images: { orderBy: { sortOrder: "asc" } } },
      },
    },
  })

  return occurrences.filter((occurrence) => {
    const submission = occurrence.submissions[0]
    const isReturned = Boolean(submission?.status === "DRAFT" && submission.returnedAt)
    const availableAt = getCheckInAvailableAt(occurrence.opensAt, occurrence.plan)
    const isInNormalWindow = now >= availableAt && now <= occurrence.dueAt
    const isInMakeupWindow = Boolean(occurrence.makeupUntil && now > occurrence.dueAt && now <= occurrence.makeupUntil)

    return isReturned || isInNormalWindow || isInMakeupWindow
  }).map((occurrence) => {
    const submission = occurrence.submissions[0]
    const availableAt = getCheckInAvailableAt(occurrence.opensAt, occurrence.plan)
    return {
      id: occurrence.id,
      title: occurrence.plan.title,
      description: occurrence.plan.description,
      groupName: occurrence.plan.group.name,
      checkInDate: occurrence.checkInDate.toISOString(),
      availableAt: availableAt.toISOString(),
      opensAt: occurrence.opensAt.toISOString(),
      dueAt: occurrence.dueAt.toISOString(),
      makeupUntil: occurrence.makeupUntil?.toISOString() ?? null,
      requiredImageCount: occurrence.requiredImageCount,
      maxImageCount: occurrence.maxImageCount,
      currentTime: now.toISOString(),
      submission: submission ? {
        id: submission.id,
        status: submission.status,
        submittedAt: submission.submittedAt?.toISOString() ?? null,
        note: submission.note,
        reviewNote: submission.reviewNote,
        returnedAt: submission.returnedAt?.toISOString() ?? null,
        images: submission.images.map((image) => ({
          id: image.id,
          url: cosUploadUrl(image.storageKey),
          originalName: image.originalName,
        })),
      } : null,
    }
  })
}
