import "server-only"

import { randomUUID } from "node:crypto"
import { unlink } from "node:fs/promises"
import path from "node:path"
import COS from "cos-nodejs-sdk-v5"

const COS_UPLOAD_PREFIX = "homework"
const LEGACY_UPLOAD_PREFIX = "uploads"
const LEGACY_UPLOAD_ROOT = path.join(
  /*turbopackIgnore: true*/ process.cwd(),
  "public",
  LEGACY_UPLOAD_PREFIX
)
const MAX_FILE_SIZE = 10 * 1024 * 1024

export function getCosConfig() {
  const SecretId = process.env.TENCENT_COS_SECRET_ID
  const SecretKey = process.env.TENCENT_COS_SECRET_KEY
  const Bucket = process.env.TENCENT_COS_BUCKET
  const Region = process.env.TENCENT_COS_REGION

  const missing = [
    ["TENCENT_COS_SECRET_ID", SecretId],
    ["TENCENT_COS_SECRET_KEY", SecretKey],
    ["TENCENT_COS_BUCKET", Bucket],
    ["TENCENT_COS_REGION", Region],
  ].filter(([, value]) => !value).map(([name]) => name)

  if (missing.length) {
    throw new Error(`缺少腾讯云 COS 配置：${missing.join("、")}`)
  }

  return {
    SecretId: SecretId as string,
    SecretKey: SecretKey as string,
    Bucket: Bucket as string,
    Region: Region as string,
  }
}

let cosClient: COS | undefined

function getCosClient() {
  const config = getCosConfig()
  cosClient ??= new COS({ SecretId: config.SecretId, SecretKey: config.SecretKey })
  return { cos: cosClient, Bucket: config.Bucket, Region: config.Region }
}

function isCosObjectMissing(error: unknown) {
  if (!error || typeof error !== "object") return false
  const cosError = error as { code?: string; statusCode?: number }
  return cosError.statusCode === 404 || cosError.code === "NoSuchKey"
}

const extensionsByMimeType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
}

export function validateImageFile(file: File) {
  return validateImageMetadata({ mimeType: file.type, sizeBytes: file.size })
}

export function validateImageMetadata({
  mimeType,
  sizeBytes,
}: {
  mimeType: string
  sizeBytes: number
}) {
  const extension = extensionsByMimeType[mimeType.toLowerCase()]

  if (!extension) {
    return { error: "仅支持 JPG、PNG、WebP、HEIC 图片。" as const }
  }
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > MAX_FILE_SIZE) {
    return { error: "单张图片不能超过 10MB。" as const }
  }

  return { extension }
}

export function createCosUploadKey({
  mimeType,
  userId,
  occurrenceId,
}: {
  mimeType: string
  userId: string
  occurrenceId: string
}) {
  const validation = validateImageMetadata({ mimeType, sizeBytes: 1 })
  if ("error" in validation) throw new Error(validation.error)

  const filename = `${randomUUID()}.${validation.extension}`
  return path.posix.join(COS_UPLOAD_PREFIX, userId, occurrenceId, filename)
}

export function isUserCosUploadKey({
  storageKey,
  userId,
  occurrenceId,
}: {
  storageKey: string
  userId: string
  occurrenceId: string
}) {
  const prefix = `${path.posix.join(COS_UPLOAD_PREFIX, userId, occurrenceId)}/`
  return storageKey.startsWith(prefix) && !storageKey.slice(prefix.length).includes("/")
}

export function getCosPublicConfig() {
  const { Bucket, Region } = getCosConfig()
  return { Bucket, Region }
}

export async function verifyCosUpload({
  storageKey,
  mimeType,
  sizeBytes,
}: {
  storageKey: string
  mimeType: string
  sizeBytes: number
}) {
  const { cos, Bucket, Region } = getCosClient()
  const result = await cos.headObject({ Bucket, Region, Key: storageKey })
  const actualSize = Number(result.headers?.["content-length"])
  const actualType = String(result.headers?.["content-type"] ?? "").split(";", 1)[0].toLowerCase()

  if (actualSize !== sizeBytes || actualType !== mimeType.toLowerCase()) {
    throw new Error("COS 中的图片信息与上传申请不一致。")
  }

  return { etag: result.ETag }
}

export async function removeCosUpload(storageKey: string) {
  if (storageKey.startsWith(`${LEGACY_UPLOAD_PREFIX}/`)) {
    const relativeKey = storageKey.slice(`${LEGACY_UPLOAD_PREFIX}/`.length)
    const absolutePath = path.resolve(
      /*turbopackIgnore: true*/ LEGACY_UPLOAD_ROOT,
      ...relativeKey.split("/")
    )
    const uploadRootWithSeparator = `${path.resolve(LEGACY_UPLOAD_ROOT)}${path.sep}`

    if (absolutePath.startsWith(uploadRootWithSeparator)) {
      await unlink(absolutePath).catch(() => undefined)
    }
    return
  }

  if (!storageKey.startsWith(`${COS_UPLOAD_PREFIX}/`)) return

  const { cos, Bucket, Region } = getCosClient()
  await cos.deleteObject({ Bucket, Region, Key: storageKey })

  try {
    await cos.headObject({ Bucket, Region, Key: storageKey })
  } catch (error) {
    if (isCosObjectMissing(error)) return
    throw error
  }

  throw new Error("腾讯云 COS 返回删除成功，但对象仍然存在。")
}

export function cosUploadUrl(storageKey: string) {
  if (!storageKey.startsWith(`${COS_UPLOAD_PREFIX}/`)) {
    return `/${storageKey.split(path.sep).join("/")}`
  }

  const encodedKey = storageKey.split("/").map(encodeURIComponent).join("/")
  const cdnDomain = process.env.NEXT_PUBLIC_CDN_DOMAIN?.trim().replace(/\/$/, "")

  if (cdnDomain) {
    const baseUrl = /^https?:\/\//i.test(cdnDomain) ? cdnDomain : `https://${cdnDomain}`
    return `${baseUrl}/${encodedKey}`
  }

  const { Bucket, Region } = getCosConfig()
  return `https://${Bucket}.cos.${Region}.myqcloud.com/${encodedKey}`
}
