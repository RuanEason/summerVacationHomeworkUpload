import { z } from "zod"

import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { removeCosUpload } from "@/lib/uploads"

export const runtime = "nodejs"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return Response.json({ message: "请先登录。" }, { status: 401 })

  const imageId = z.string().uuid().safeParse((await params).id)
  if (!imageId.success) return Response.json({ message: "图片参数无效。" }, { status: 400 })

  const image = await prisma.submissionImage.findUnique({
    where: { id: imageId.data },
    include: { submission: true },
  })
  if (!image || image.submission.userId !== user.id) {
    return Response.json({ message: "图片不存在。" }, { status: 404 })
  }
  if (image.submission.status !== "DRAFT") {
    return Response.json({ message: "已提交的图片不能删除。" }, { status: 409 })
  }

  try {
    await removeCosUpload(image.storageKey)
  } catch (error) {
    console.error("Failed to delete submission image from storage", {
      imageId: image.id,
      storageKey: image.storageKey,
      error,
    })
    return Response.json({ message: "云端图片删除失败，请稍后重试。" }, { status: 502 })
  }

  try {
    await prisma.submissionImage.delete({ where: { id: image.id } })
  } catch (error) {
    console.error("Failed to delete submission image record", {
      imageId: image.id,
      error,
    })
    return Response.json({ message: "图片记录删除失败，请刷新页面后重试。" }, { status: 500 })
  }

  return Response.json({ success: true })
}
