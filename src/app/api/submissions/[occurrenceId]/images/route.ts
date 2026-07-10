import { z } from "zod"

import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { publicUploadUrl, removePublicUpload, savePublicUpload, validateImageContent, validateImageFile } from "@/lib/uploads"

export const runtime = "nodejs"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ occurrenceId: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ message: "请先登录。" }, { status: 401 })

  const occurrenceId = z.string().uuid().safeParse((await params).occurrenceId)
  if (!occurrenceId.success) return Response.json({ message: "任务参数无效。" }, { status: 400 })

  const occurrence = await prisma.checkInOccurrence.findUnique({
    where: { id: occurrenceId.data },
    include: { plan: true },
  })
  if (!occurrence || occurrence.plan.status !== "ACTIVE") {
    return Response.json({ message: "打卡任务不存在或规则已暂停。" }, { status: 404 })
  }

  const membership = await prisma.groupMember.findUnique({ where: { userId: user.id } })
  if (!membership || membership.groupId !== occurrence.plan.groupId || !membership.participatesInCheckIn) {
    return Response.json({ message: "你不是该任务的打卡成员。" }, { status: 403 })
  }

  const existing = await prisma.submission.findUnique({
    where: { occurrenceId_userId: { occurrenceId: occurrence.id, userId: user.id } },
    include: { _count: { select: { images: true } } },
  })
  if (existing && existing.status !== "DRAFT") {
    return Response.json({ message: "该任务已经提交，不能继续添加图片。" }, { status: 409 })
  }

  const now = new Date()
  const isReturned = Boolean(existing?.returnedAt)
  const canUpload = isReturned || (now >= occurrence.opensAt &&
    (now <= occurrence.dueAt || Boolean(occurrence.makeupUntil && now <= occurrence.makeupUntil)))
  if (!canUpload) {
    return Response.json({ message: now < occurrence.opensAt ? "打卡尚未开始。" : "打卡和补卡时间均已结束。" }, { status: 409 })
  }

  const formData = await request.formData()
  const files = formData.getAll("files").filter((item): item is File => item instanceof File)
  if (!files.length) return Response.json({ message: "请选择图片。" }, { status: 400 })

  for (const file of files) {
    const validation = validateImageFile(file)
    if ("error" in validation) return Response.json({ message: validation.error }, { status: 400 })
    if (!(await validateImageContent(file))) {
      return Response.json({ message: `${file.name || "所选文件"} 不是有效的图片文件。` }, { status: 400 })
    }
  }
  if (files.reduce((total, file) => total + file.size, 0) > 50 * 1024 * 1024) {
    return Response.json({ message: "单次上传总大小不能超过 50MB，请分批上传。" }, { status: 400 })
  }

  if ((existing?._count.images ?? 0) + files.length > occurrence.maxImageCount) {
    return Response.json({ message: `最多只能上传 ${occurrence.maxImageCount} 张图片。` }, { status: 400 })
  }

  const submission = existing ?? await prisma.submission.create({
    data: { occurrenceId: occurrence.id, userId: user.id, status: "DRAFT" },
  })
  const savedFiles: Awaited<ReturnType<typeof savePublicUpload>>[] = []

  try {
    for (const file of files) {
      savedFiles.push(await savePublicUpload({ file, userId: user.id, occurrenceId: occurrence.id }))
    }

    const images = await prisma.$transaction(
      savedFiles.map((file, index) => prisma.submissionImage.create({
        data: {
          submissionId: submission.id,
          ...file,
          sortOrder: (existing?._count.images ?? 0) + index,
        },
      }))
    )

    return Response.json({
      images: images.map((image) => ({
        id: image.id,
        url: publicUploadUrl(image.storageKey),
        originalName: image.originalName,
      })),
    })
  } catch {
    await Promise.all(savedFiles.map((file) => removePublicUpload(file.storageKey)))
    return Response.json({ message: "图片保存失败，请重试。" }, { status: 500 })
  }
}
