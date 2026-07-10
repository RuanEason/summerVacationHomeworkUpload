import "server-only"

import { createHash, randomUUID } from "node:crypto"
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

function getCosConfig() {
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
  const extension = extensionsByMimeType[file.type.toLowerCase()]

  if (!extension) {
    return { error: "仅支持 JPG、PNG、WebP、HEIC 图片。" as const }
  }
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    return { error: "单张图片不能超过 10MB。" as const }
  }

  return { extension }
}

export async function validateImageContent(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  const mimeType = file.type.toLowerCase()

  if (mimeType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  }
  if (mimeType === "image/png") {
    return bytes.slice(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index])
  }
  if (mimeType === "image/webp") {
    return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  }
  if (mimeType === "image/heic" || mimeType === "image/heif") {
    return String.fromCharCode(...bytes.slice(4, 8)) === "ftyp"
  }

  return false
}

export async function saveCosUpload({
  file,
  userId,
  occurrenceId,
}: {
  file: File
  userId: string
  occurrenceId: string
}) {
  const validation = validateImageFile(file)
  if ("error" in validation) throw new Error(validation.error)

  const filename = `${randomUUID()}.${validation.extension}`
  const storageKey = path.posix.join(COS_UPLOAD_PREFIX, userId, occurrenceId, filename)
  const buffer = Buffer.from(await file.arrayBuffer())
  const { cos, Bucket, Region } = getCosClient()

  await cos.putObject({
    Bucket,
    Region,
    Key: storageKey,
    Body: buffer,
    ContentLength: buffer.length,
    ContentType: file.type,
    CacheControl: "public, max-age=31536000, immutable",
  })

  return {
    storageKey,
    originalName: file.name.slice(0, 255) || filename,
    mimeType: file.type,
    sizeBytes: file.size,
    checksum: createHash("sha256").update(buffer).digest("hex"),
  }
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
