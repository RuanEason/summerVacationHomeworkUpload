import { z } from "zod"

import { issueCosUploadCredentials } from "@/lib/cos-sts"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/session"
import {
  cosUploadUrl,
  createCosUploadKey,
  isUserCosUploadKey,
  removeCosUpload,
  validateImageMetadata,
  verifyCosUpload,
} from "@/lib/uploads"

export const runtime = "nodejs"

const fileMetadataSchema = z.object({
  originalName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(100),
  sizeBytes: z.number().int().positive(),
})

const prepareSchema = z.object({
  files: z.array(fileMetadataSchema).min(1).max(9),
})

const completeSchema = z.object({
  files: z.array(fileMetadataSchema.extend({ storageKey: z.string().min(1).max(500) })).min(1).max(9),
})

const cleanupSchema = z.object({
  storageKeys: z.array(z.string().min(1).max(500)).min(1).max(9),
})

async function getUploadContext(occurrenceIdValue: string, requireUploadWindow = true) {
  const user = await getCurrentUser()
  if (!user) return { response: Response.json({ message: "请先登录。" }, { status: 401 }) }

  const occurrenceId = z.string().uuid().safeParse(occurrenceIdValue)
  if (!occurrenceId.success) {
    return { response: Response.json({ message: "任务参数无效。" }, { status: 400 }) }
  }

  const occurrence = await prisma.checkInOccurrence.findUnique({
    where: { id: occurrenceId.data },
    include: { plan: true },
  })
  if (!occurrence || occurrence.plan.status !== "ACTIVE") {
    return { response: Response.json({ message: "打卡任务不存在或规则已暂停。" }, { status: 404 }) }
  }

  const membership = await prisma.groupMember.findUnique({ where: { userId: user.id } })
  if (!membership || membership.groupId !== occurrence.plan.groupId || !membership.participatesInCheckIn) {
    return { response: Response.json({ message: "你不是该任务的打卡成员。" }, { status: 403 }) }
  }

  const existing = await prisma.submission.findUnique({
    where: { occurrenceId_userId: { occurrenceId: occurrence.id, userId: user.id } },
    include: { _count: { select: { images: true } } },
  })
  if (existing && existing.status !== "DRAFT") {
    return { response: Response.json({ message: "该任务已经提交，不能继续修改图片。" }, { status: 409 }) }
  }

  if (requireUploadWindow) {
    const now = new Date()
    const isReturned = Boolean(existing?.returnedAt)
    const canUpload = isReturned || (now >= occurrence.opensAt &&
      (now <= occurrence.dueAt || Boolean(occurrence.makeupUntil && now <= occurrence.makeupUntil)))
    if (!canUpload) {
      return {
        response: Response.json({
          message: now < occurrence.opensAt ? "打卡尚未开始。" : "打卡和补卡时间均已结束。",
        }, { status: 409 }),
      }
    }
  }

  return { user, occurrence, existing }
}

function validateFileBatch(files: Array<{ mimeType: string; sizeBytes: number }>) {
  for (const file of files) {
    const validation = validateImageMetadata(file)
    if ("error" in validation) return validation.error
  }
  if (files.reduce((total, file) => total + file.sizeBytes, 0) > 50 * 1024 * 1024) {
    return "单次上传总大小不能超过 50MB，请分批上传。"
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ occurrenceId: string }> }
) {
  const context = await getUploadContext((await params).occurrenceId)
  if ("response" in context) return context.response

  const payload = prepareSchema.safeParse(await request.json().catch(() => null))
  if (!payload.success) return Response.json({ message: "上传文件参数无效。" }, { status: 400 })

  const validationError = validateFileBatch(payload.data.files)
  if (validationError) return Response.json({ message: validationError }, { status: 400 })

  if ((context.existing?._count.images ?? 0) + payload.data.files.length > context.occurrence.maxImageCount) {
    return Response.json({ message: `最多只能上传 ${context.occurrence.maxImageCount} 张图片。` }, { status: 400 })
  }

  const files = payload.data.files.map((file) => ({
    ...file,
    storageKey: createCosUploadKey({
      mimeType: file.mimeType,
      userId: context.user.id,
      occurrenceId: context.occurrence.id,
    }),
  }))

  try {
    const upload = await issueCosUploadCredentials(files.map((file) => file.storageKey))
    return Response.json({ upload, files })
  } catch (error) {
    console.error("Failed to issue COS STS credentials", { userId: context.user.id, error })
    return Response.json({ message: "获取图片直传凭证失败，请稍后重试。" }, { status: 502 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ occurrenceId: string }> }
) {
  const context = await getUploadContext((await params).occurrenceId)
  if ("response" in context) return context.response

  const payload = completeSchema.safeParse(await request.json().catch(() => null))
  if (!payload.success) return Response.json({ message: "图片确认参数无效。" }, { status: 400 })

  const validationError = validateFileBatch(payload.data.files)
  if (validationError) return Response.json({ message: validationError }, { status: 400 })

  const storageKeys = payload.data.files.map((file) => file.storageKey)
  if (new Set(storageKeys).size !== storageKeys.length || payload.data.files.some((file) => !isUserCosUploadKey({
    storageKey: file.storageKey,
    userId: context.user.id,
    occurrenceId: context.occurrence.id,
  }))) {
    return Response.json({ message: "图片存储路径无效。" }, { status: 400 })
  }

  const currentImageCount = context.existing?._count.images ?? 0
  if (currentImageCount + payload.data.files.length > context.occurrence.maxImageCount) {
    return Response.json({ message: `最多只能上传 ${context.occurrence.maxImageCount} 张图片。` }, { status: 400 })
  }

  const duplicate = await prisma.submissionImage.findFirst({ where: { storageKey: { in: storageKeys } } })
  if (duplicate) return Response.json({ message: "图片已经登记，请刷新页面。" }, { status: 409 })

  try {
    await Promise.all(payload.data.files.map((file) => verifyCosUpload(file)))
  } catch (error) {
    console.error("Failed to verify direct COS upload", { userId: context.user.id, error })
    return Response.json({ message: "COS 图片校验失败，请重新上传。" }, { status: 400 })
  }

  const submission = context.existing ?? await prisma.submission.create({
    data: { occurrenceId: context.occurrence.id, userId: context.user.id, status: "DRAFT" },
  })

  try {
    const images = await prisma.$transaction(
      payload.data.files.map((file, index) => prisma.submissionImage.create({
        data: {
          submissionId: submission.id,
          storageKey: file.storageKey,
          originalName: file.originalName,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
          sortOrder: currentImageCount + index,
        },
      }))
    )

    return Response.json({
      images: images.map((image) => ({
        id: image.id,
        url: cosUploadUrl(image.storageKey),
        originalName: image.originalName,
      })),
    })
  } catch (error) {
    console.error("Failed to register direct COS upload", { userId: context.user.id, error })
    await Promise.allSettled(storageKeys.map((storageKey) => removeCosUpload(storageKey)))
    return Response.json({ message: "图片登记失败，请重新上传。" }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ occurrenceId: string }> }
) {
  const context = await getUploadContext((await params).occurrenceId, false)
  if ("response" in context) return context.response

  const payload = cleanupSchema.safeParse(await request.json().catch(() => null))
  if (!payload.success) return Response.json({ message: "清理参数无效。" }, { status: 400 })

  const storageKeys = [...new Set(payload.data.storageKeys)].filter((storageKey) => isUserCosUploadKey({
    storageKey,
    userId: context.user.id,
    occurrenceId: context.occurrence.id,
  }))
  const registered = await prisma.submissionImage.findMany({
    where: { storageKey: { in: storageKeys } },
    select: { storageKey: true },
  })
  const registeredKeys = new Set(registered.map((image) => image.storageKey))

  await Promise.allSettled(
    storageKeys.filter((storageKey) => !registeredKeys.has(storageKey)).map(removeCosUpload)
  )
  return Response.json({ success: true })
}
