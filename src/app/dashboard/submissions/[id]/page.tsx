import Link from "next/link"
import { ArrowLeft, CalendarDays, Clock3, ImageIcon, MessageSquareText, RotateCcw, UserRound } from "lucide-react"
import { notFound } from "next/navigation"
import { z } from "zod"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requireRole } from "@/lib/auth"
import { returnSubmission } from "@/app/actions/admin"
import { formatShanghaiDate } from "@/lib/dates"
import { prisma } from "@/lib/prisma"
import { cosUploadUrl } from "@/lib/uploads"

export default async function SubmissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireRole(["ROOT", "ADMIN"])
  const parsedId = z.string().uuid().safeParse((await params).id)
  if (!parsedId.success) notFound()

  const submission = await prisma.submission.findUnique({
    where: { id: parsedId.data },
    include: {
      user: true,
      images: { orderBy: { sortOrder: "asc" } },
      occurrence: { include: { plan: { include: { group: true } } } },
    },
  })
  if (!submission) notFound()

  const canView = viewer.role === "ROOT" || submission.occurrence.plan.group.ownerAdminId === viewer.id
  if (!canView) notFound()

  const statusLabel = submission.status === "MAKEUP" ? "补卡提交" : submission.status === "SUBMITTED" ? "准时提交" : submission.status === "DRAFT" ? "草稿" : "已作废"

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-10">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2"><Link href="/dashboard/submissions"><ArrowLeft />返回提交记录</Link></Button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{submission.user.displayName} 的作业</h1><p className="mt-1 text-muted-foreground">{submission.occurrence.plan.title} · {submission.occurrence.plan.group.name}</p></div><Badge variant={submission.status === "MAKEUP" ? "secondary" : submission.status === "SUBMITTED" ? "default" : "outline"}>{submission.status === "MAKEUP" ? <RotateCcw /> : null}{statusLabel}</Badge></div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="flex items-center gap-3 pt-4"><UserRound className="size-5 text-primary" /><div><p className="text-xs text-muted-foreground">提交用户</p><p className="font-medium">{submission.user.displayName}（{submission.user.username}）</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 pt-4"><CalendarDays className="size-5 text-primary" /><div><p className="text-xs text-muted-foreground">打卡日期</p><p className="font-medium">{formatShanghaiDate(submission.occurrence.checkInDate, { year: "numeric", month: "long", day: "numeric" })}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 pt-4"><Clock3 className="size-5 text-primary" /><div><p className="text-xs text-muted-foreground">提交时间</p><p className="font-medium">{submission.submittedAt ? formatShanghaiDate(submission.submittedAt, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : "尚未提交"}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 pt-4"><ImageIcon className="size-5 text-primary" /><div><p className="text-xs text-muted-foreground">图片数量</p><p className="font-medium">{submission.images.length} 张 / 要求 {submission.occurrence.requiredImageCount} 张</p></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>作业原图</CardTitle><CardDescription>点击图片可在新窗口查看原始文件。</CardDescription></CardHeader>
        <CardContent>
          {submission.images.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{submission.images.map((image, index) => <a key={image.id} href={cosUploadUrl(image.storageKey)} target="_blank" rel="noreferrer" className="group space-y-2"><div className="aspect-square rounded-xl border bg-muted bg-cover bg-center transition-transform group-hover:scale-[1.01]" style={{ backgroundImage: `url(${JSON.stringify(cosUploadUrl(image.storageKey))})` }} /><div className="px-1 text-xs text-muted-foreground"><p className="truncate">图片 {index + 1} · {image.originalName}</p><p>{(image.sizeBytes / 1024 / 1024).toFixed(2)} MB · {image.mimeType}</p></div></a>)}</div> : <div className="flex min-h-52 items-center justify-center text-muted-foreground">该提交没有图片</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><MessageSquareText className="size-5" />用户备注</CardTitle></CardHeader>
        <CardContent><p className="min-h-20 whitespace-pre-wrap rounded-xl bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">{submission.note || "用户没有填写备注。"}</p></CardContent>
      </Card>

      {submission.reviewNote ? <Card><CardHeader><CardTitle>最近退回原因</CardTitle><CardDescription>{submission.returnedAt ? `退回于 ${formatShanghaiDate(submission.returnedAt, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })}` : ""}</CardDescription></CardHeader><CardContent><p className="rounded-xl bg-destructive/5 p-4 text-sm text-destructive">{submission.reviewNote}</p></CardContent></Card> : null}

      {["SUBMITTED", "MAKEUP"].includes(submission.status) ? <Card className="border-destructive/30"><CardHeader><CardTitle>退回修改</CardTitle><CardDescription>退回后提交会恢复为草稿，用户可以删除、补传图片并重新提交。</CardDescription></CardHeader><CardContent><form action={returnSubmission.bind(null, submission.id)} className="space-y-3"><textarea name="reviewNote" required minLength={2} maxLength={500} placeholder="请填写退回原因，例如：图片不清晰，请重新上传第 2 张" className="min-h-24 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" /><Button type="submit" variant="destructive"><RotateCcw />退回给用户修改</Button></form></CardContent></Card> : null}
    </div>
  )
}
