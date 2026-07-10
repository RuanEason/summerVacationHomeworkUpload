import "server-only"

import { dateKeyToDatabaseDate, getShanghaiDateKey } from "@/lib/dates"
import { prisma } from "@/lib/prisma"
import { publicUploadUrl } from "@/lib/uploads"

export async function getAvailableCheckInTasks(userId: string) {
  const now = new Date()
  const today = dateKeyToDatabaseDate(getShanghaiDateKey(now))
  const occurrences = await prisma.checkInOccurrence.findMany({
    where: {
      plan: {
        status: "ACTIVE",
        group: {
          members: { some: { userId, participatesInCheckIn: true } },
        },
      },
      OR: [
        { checkInDate: today },
        { checkInDate: { lt: today }, makeupUntil: { gte: now } },
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
    orderBy: { checkInDate: "desc" },
    include: {
      plan: { include: { group: true } },
      submissions: {
        where: { userId },
        include: { images: { orderBy: { sortOrder: "asc" } } },
      },
    },
  })

  return occurrences.map((occurrence) => {
    const submission = occurrence.submissions[0]
    return {
      id: occurrence.id,
      title: occurrence.plan.title,
      description: occurrence.plan.description,
      groupName: occurrence.plan.group.name,
      checkInDate: occurrence.checkInDate.toISOString(),
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
          url: publicUploadUrl(image.storageKey),
          originalName: image.originalName,
        })),
      } : null,
    }
  })
}
