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
type CheckInTask = {
  id: string
  title: string
  description: string | null
  groupName: string
  checkInDate: string
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

export function CheckInTaskCard({ task }: { task: CheckInTask }) {
  const [images, setImages] = useState(task.submission?.images ?? [])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string>()
  const [state, action, submitting] = useActionState(submitCheckIn, initialState)
  const inputRef = useRef<HTMLInputElement>(null)
  const now = new Date(task.currentTime).getTime()
  const finalSubmission = task.submission && ["SUBMITTED", "MAKEUP"].includes(task.submission.status)

  const timing = useMemo(() => {
    if (finalSubmission) return { label: task.submission?.status === "MAKEUP" ? "已补卡" : "已提交", variant: "default" as const, canEdit: false }
    if (task.submission?.returnedAt) return { label: "待重交", variant: "destructive" as const, canEdit: true }
    if (now < new Date(task.opensAt).getTime()) return { label: "未开始", variant: "outline" as const, canEdit: false }
    if (now <= new Date(task.dueAt).getTime()) return { label: "进行中", variant: "default" as const, canEdit: true }
    if (task.makeupUntil && now <= new Date(task.makeupUntil).getTime()) return { label: "补卡中", variant: "secondary" as const, canEdit: true }
    return { label: "已过期", variant: "destructive" as const, canEdit: false }
  }, [finalSubmission, now, task.dueAt, task.makeupUntil, task.opensAt, task.submission?.returnedAt, task.submission?.status])

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList?.length) return
    setUploadError(undefined)
    const selected = Array.from(fileList)

    if (images.length + selected.length > task.maxImageCount) {
      setUploadError(`最多只能上传 ${task.maxImageCount} 张图片。`)
      if (inputRef.current) inputRef.current.value = ""
      return
    }

    const formData = new FormData()
    selected.forEach((file) => formData.append("files", file))
    setUploading(true)

    try {
      const response = await fetch(`/api/submissions/${task.id}/images`, {
        method: "POST",
        body: formData,
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || "图片上传失败。")
      setImages((current) => [...current, ...result.images])
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "图片上传失败。")
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  async function deleteImage(imageId: string) {
    setUploadError(undefined)
    const response = await fetch(`/api/submission-images/${imageId}`, { method: "DELETE" })
    const result = await response.json()
    if (!response.ok) {
      setUploadError(result.message || "删除图片失败。")
      return
    }
    setImages((current) => current.filter((image) => image.id !== imageId))
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

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl border p-3"><p className="flex items-center gap-1.5 text-muted-foreground"><Clock3 className="size-4" />正常截止</p><p className="mt-1 font-medium">{formatDateTime(task.dueAt)}</p></div>
          <div className="rounded-xl border p-3"><p className="flex items-center gap-1.5 text-muted-foreground"><RotateCcw className="size-4" />补卡截止</p><p className="mt-1 font-medium">{task.makeupUntil ? formatDateTime(task.makeupUntil) : "不允许补卡"}</p></div>
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
                  <Button type="button" variant="destructive" size="icon-xs" className="absolute right-1.5 top-1.5 shadow-sm" onClick={() => deleteImage(image.id)} aria-label="删除图片"><Trash2 /></Button>
                ) : null}
              </div>
            ))}

            {!finalSubmission && timing.canEdit && images.length < task.maxImageCount ? (
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/20 text-center text-xs text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary">
                {uploading ? <LoaderCircle className="size-7 animate-spin" /> : <ImagePlus className="size-7" />}
                {uploading ? "上传中" : "添加图片"}
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
