import "server-only"

import { createHash, randomUUID } from "node:crypto"
import { mkdir, unlink, writeFile } from "node:fs/promises"
import path from "node:path"

const UPLOAD_ROOT = path.join(
  /*turbopackIgnore: true*/ process.cwd(),
  "public",
  "uploads"
)
const MAX_FILE_SIZE = 10 * 1024 * 1024

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

export async function savePublicUpload({
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

  const relativeDirectory = path.posix.join(userId, occurrenceId)
  const filename = `${randomUUID()}.${validation.extension}`
  const storageKey = path.posix.join("uploads", relativeDirectory, filename)
  const absoluteDirectory = path.join(
    /*turbopackIgnore: true*/ UPLOAD_ROOT,
    userId,
    occurrenceId
  )
  const absolutePath = path.join(absoluteDirectory, filename)
  const buffer = Buffer.from(await file.arrayBuffer())

  await mkdir(absoluteDirectory, { recursive: true })
  await writeFile(absolutePath, buffer, { flag: "wx" })

  return {
    storageKey,
    originalName: file.name.slice(0, 255) || filename,
    mimeType: file.type,
    sizeBytes: file.size,
    checksum: createHash("sha256").update(buffer).digest("hex"),
  }
}

export async function removePublicUpload(storageKey: string) {
  if (!storageKey.startsWith("uploads/")) return

  const relativeKey = storageKey.slice("uploads/".length)
  const absolutePath = path.resolve(
    /*turbopackIgnore: true*/ UPLOAD_ROOT,
    ...relativeKey.split("/")
  )
  const uploadRootWithSeparator = `${path.resolve(UPLOAD_ROOT)}${path.sep}`

  if (!absolutePath.startsWith(uploadRootWithSeparator)) return

  await unlink(absolutePath).catch(() => undefined)
}

export function publicUploadUrl(storageKey: string) {
  return `/${storageKey.split(path.sep).join("/")}`
}
