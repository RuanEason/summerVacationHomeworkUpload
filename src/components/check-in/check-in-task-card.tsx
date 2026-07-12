"use client"

import { useActionState, useMemo, useRef, useState } from "react"
import { CheckCircle2, Clock3, ImagePlus, LoaderCircle, RotateCcw, Trash2, UploadCloud } from "lucide-react"

import { submitCheckIn, type CheckInActionState } from "@/app/actions/check-in"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

type TaskImage = { id: string; url: string; originalName: string }
type DirectUploadFile = {
  storageKey: string
  originalName: string
  mimeType: string
  sizeBytes: number
}
type DirectUploadPreparation = {
  upload: {
    bucket: string
    region: string
    credentials: {
      tmpSecretId: string
      tmpSecretKey: string
      sessionToken: string
      startTime: number
      expiredTime: number
    }
  }
  files: DirectUploadFile[]
  message?: string
}
type CheckInTask = {
  id: string
  title: string
  description: string | null
  groupName: string
  checkInDate: string
  availableAt: string
  opensAt: string
  dueAt: string
  makeupUntil: string | null
  requiredImageCount: number
  maxImageCount: number
  currentTime: string
  submission: {
    id: string
    status: string
    submittedAt: string | null
    note: string | null
    reviewNote: string | null
    returnedAt: string | null
    images: TaskImage[]
  } | null
}

const initialState: CheckInActionState = {}
const MAX_FILE_SIZE = 10 * 1024 * 1024
const supportedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"])

async function isValidImageContent(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  const mimeType = file.type.toLowerCase()

  if (mimeType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (mimeType === "image/png") {
    return bytes.slice(0, 8).every((value, index) => value === [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a][index])
  }
  if (mimeType === "image/webp") {
    return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  }
  if (mimeType === "image/heic" || mimeType === "image/heif") {
    return String.fromCharCode(...bytes.slice(4, 8)) === "ftyp"
  }
  return false
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message
  }
  return fallback
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value))
}

export function CheckInTaskCard({ task: rawTask }: { task: CheckInTask }) {
  const normalOpensAt = rawTask.opensAt
  const task = { ...rawTask, opensAt: rawTask.availableAt }
  const [images, setImages] = useState(task.submission?.images ?? [])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [deletingImageId, setDeletingImageId] = useState<string>()
  const [uploadError, setUploadError] = useState<string>()
  const [state, action, submitting] = useActionState(submitCheckIn, initialState)
  const inputRef = useRef<HTMLInputElement>(null)
  const now = new Date(task.currentTime).getTime()
  const finalSubmission = task.submission && ["SUBMITTED", "MAKEUP"].includes(task.submission.status)

  const timing = useMemo(() => {
    const isEarlySubmission = task.submission?.status === "SUBMITTED" && task.submission.submittedAt && new Date(task.submission.submittedAt).getTime() < new Date(normalOpensAt).getTime()
    if (finalSubmission && isEarlySubmission) return { label: "提前打卡", variant: "default" as const, canEdit: false }
    const isInEarlyWindow = !finalSubmission && !task.submission?.returnedAt && now >= new Date(task.opensAt).getTime() && now < new Date(normalOpensAt).getTime()
    if (isInEarlyWindow) return { label: "提前打卡中", variant: "secondary" as const, canEdit: true }
    if (finalSubmission) return { label: task.submission?.status === "MAKEUP" ? "已补卡" : "已提交", variant: "default" as const, canEdit: false }
    if (task.submission?.returnedAt) return { label: "待重交", variant: "destructive" as const, canEdit: true }
    if (now < new Date(task.opensAt).getTime()) return { label: "未开始", variant: "outline" as const, canEdit: false }
    if (now <= new Date(task.dueAt).getTime()) return { label: "进行中", variant: "default" as const, canEdit: true }
    if (task.makeupUntil && now <= new Date(task.makeupUntil).getTime()) return { label: "补卡中", variant: "secondary" as const, canEdit: true }
    return { label: "已过期", variant: "destructive" as const, canEdit: false }
  }, [finalSubmission, normalOpensAt, now, task.dueAt, task.makeupUntil, task.opensAt, task.submission?.returnedAt, task.submission?.status, task.submission?.submittedAt])

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList?.length) return
    setUploadError(undefined)
    const selected = Array.from(fileList)

    if (images.length + selected.length > task.maxImageCount) {
      setUploadError(`最多只能上传 ${task.maxImageCount} 张图片。`)
      if (inputRef.current) inputRef.current.value = ""
      return
    }

    for (const file of selected) {
      if (!supportedImageTypes.has(file.type.toLowerCase())) {
        setUploadError(`${file.name || "所选文件"} 不是支持的图片格式。`)
        if (inputRef.current) inputRef.current.value = ""
        return
      }
      if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
        setUploadError(`${file.name || "所选文件"} 超过 10MB。`)
        if (inputRef.current) inputRef.current.value = ""
        return
      }
      if (!(await isValidImageContent(file))) {
        setUploadError(`${file.name || "所选文件"} 不是有效的图片文件。`)
        if (inputRef.current) inputRef.current.value = ""
        return
      }
    }
    if (selected.reduce((total, file) => total + file.size, 0) > 50 * 1024 * 1024) {
      setUploadError("单次上传总大小不能超过 50MB，请分批上传。")
      if (inputRef.current) inputRef.current.value = ""
      return
    }

    setUploading(true)
    setUploadProgress(0)
    let preparation: DirectUploadPreparation | undefined
    let uploadedKeys: string[] = []

    try {
      const prepareResponse = await fetch(`/api/submissions/${task.id}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: selected.map((file) => ({
            originalName: file.name.slice(0, 255) || "image",
            mimeType: file.type,
            sizeBytes: file.size,
          })),
        }),
      })
      preparation = await prepareResponse.json().catch(() => ({})) as DirectUploadPreparation
      if (!prepareResponse.ok) throw new Error(preparation.message || "获取图片直传凭证失败。")

      const { default: COS } = await import("cos-js-sdk-v5")
      const credentials = preparation.upload.credentials
      const cos = new COS({
        SecretId: credentials.tmpSecretId,
        SecretKey: credentials.tmpSecretKey,
        SecurityToken: credentials.sessionToken,
        StartTime: credentials.startTime,
        ExpiredTime: credentials.expiredTime,
      })
      const progressByFile = new Map<number, number>()
      const uploadResults = await Promise.allSettled(selected.map((file, index) => cos.putObject({
        Bucket: preparation!.upload.bucket,
        Region: preparation!.upload.region,
        Key: preparation!.files[index].storageKey,
        Body: file,
        ContentLength: file.size,
        ContentType: file.type,
        CacheControl: "public, max-age=31536000, immutable",
        onProgress: ({ percent }) => {
          progressByFile.set(index, percent)
          const total = selected.reduce((sum, _item, itemIndex) => sum + (progressByFile.get(itemIndex) ?? 0), 0)
          setUploadProgress(total / selected.length)
        },
      })))
      uploadedKeys = uploadResults.flatMap((result, index) => result.status === "fulfilled" ? [preparation!.files[index].storageKey] : [])
      const failedUpload = uploadResults.find((result) => result.status === "rejected")
      if (failedUpload?.status === "rejected") throw failedUpload.reason

      const completeResponse = await fetch(`/api/submissions/${task.id}/images`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: preparation.files }),
      })
      const result = await completeResponse.json().catch(() => ({})) as { images?: TaskImage[]; message?: string }
      if (!completeResponse.ok || !result.images) throw new Error(result.message || "图片登记失败。")

      uploadedKeys = []
      setImages((current) => [...current, ...result.images!])
    } catch (error) {
      if (uploadedKeys.length) {
        await fetch(`/api/submissions/${task.id}/images`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storageKeys: uploadedKeys }),
        }).catch(() => undefined)
      }
      setUploadError(errorMessage(error, "图片直传失败，请检查网络后重试。"))
    } finally {
      setUploading(false)
      setUploadProgress(0)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  async function deleteImage(imageId: string) {
    if (deletingImageId) return

    setUploadError(undefined)
    setDeletingImageId(imageId)

    try {
      const response = await fetch(`/api/submission-images/${imageId}`, { method: "DELETE" })
      const result = await response.json().catch(() => ({})) as { message?: string }

      if (!response.ok) {
        throw new Error(result.message || `删除图片失败（${response.status}）。`)
      }

      setImages((current) => current.filter((image) => image.id !== imageId))
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "删除图片失败，请检查网络后重试。")
    } finally {
      setDeletingImageId(undefined)
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/25">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate text-lg">{task.title}</CardTitle>
            <CardDescription className="mt-1">{task.groupName} · {formatDateTime(task.checkInDate).slice(0, 5)}</CardDescription>
          </div>
          <Badge variant={timing.variant}>{timing.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        {task.description ? <p className="rounded-xl bg-muted/40 p-3 text-sm leading-6 text-muted-foreground">{task.description}</p> : null}

        {task.availableAt !== normalOpensAt && now < new Date(normalOpensAt).getTime() ? <p className="rounded-xl border border-secondary/40 bg-secondary/10 p-3 text-sm text-muted-foreground">提前打卡已开放，原定开放时间：<span className="font-medium text-foreground">{formatDateTime(normalOpensAt)}</span></p> : null}

        <div className="grid grid-cols-2 rounded-xl  text-sm">
          <div className="border p-3"><p className="flex items-center gap-1.5 text-muted-foreground"><Clock3 className="size-4" />正常截止</p><p className="mt-1 font-medium">{formatDateTime(task.dueAt)}</p></div>
          <div className="border p-3"><p className="flex items-center gap-1.5 text-muted-foreground"><RotateCcw className="size-4" />补卡截止</p><p className="mt-1 font-medium">{task.makeupUntil ? formatDateTime(task.makeupUntil) : "不允许补卡"}</p></div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div><p className="font-medium">作业图片</p><p className="text-sm text-muted-foreground">至少 {task.requiredImageCount} 张，最多 {task.maxImageCount} 张</p></div>
            <Badge variant={images.length >= task.requiredImageCount ? "default" : "secondary"}>{images.length}/{task.requiredImageCount}</Badge>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {images.map((image) => (
              <div key={image.id} className="group relative aspect-square overflow-hidden rounded-xl border bg-muted">
                <div className="size-full bg-cover bg-center" style={{ backgroundImage: `url(${JSON.stringify(image.url)})` }} role="img" aria-label={image.originalName} />
                {!finalSubmission && timing.canEdit ? (
                  <Button type="button" variant="destructive" size="icon-xs" className="absolute right-1.5 top-1.5 shadow-sm" disabled={Boolean(deletingImageId)} onClick={() => deleteImage(image.id)} aria-label={deletingImageId === image.id ? "正在删除图片" : "删除图片"}>
                    {deletingImageId === image.id ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
                  </Button>
                ) : null}
              </div>
            ))}

            {!finalSubmission && timing.canEdit && images.length < task.maxImageCount ? (
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/20 text-center text-xs text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary">
                {uploading ? <LoaderCircle className="size-7 animate-spin" /> : <ImagePlus className="size-7" />}
                {uploading ? `上传中 ${Math.round(uploadProgress * 100)}%` : "添加图片"}
                <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple className="sr-only" disabled={uploading} onChange={(event) => uploadFiles(event.target.files)} />
              </label>
            ) : null}
          </div>
        </div>

        {uploadError ? <Alert variant="destructive"><AlertDescription>{uploadError}</AlertDescription></Alert> : null}
        {task.submission?.reviewNote ? <Alert variant="destructive"><RotateCcw /><AlertDescription><span className="font-medium">管理员退回：</span>{task.submission.reviewNote}</AlertDescription></Alert> : null}
        {state.message ? <Alert variant={state.success ? "default" : "destructive"}>{state.success ? <CheckCircle2 /> : null}<AlertDescription>{state.message}</AlertDescription></Alert> : null}

        {finalSubmission ? (
          <div className="flex items-center gap-3 rounded-xl bg-primary/5 p-4 text-sm"><CheckCircle2 className="size-5 shrink-0 text-primary" /><div><p className="font-medium">作业已经提交</p><p className="text-muted-foreground">提交后图片不可删除，如需修改请联系管理员。</p></div></div>
        ) : (
          <form action={action} className="space-y-3">
            <input type="hidden" name="occurrenceId" value={task.id} />
            <Textarea name="note" placeholder="给管理员的备注，可选" maxLength={500} />
            <Button className="h-11 w-full text-base" type="submit" disabled={!timing.canEdit || uploading || submitting || images.length < task.requiredImageCount}>
              {submitting ? <LoaderCircle className="animate-spin" /> : timing.label === "补卡中" ? <RotateCcw /> : <UploadCloud />}
              {submitting ? "正在提交…" : timing.label === "补卡中" ? "提交补卡" : "确认提交打卡"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
