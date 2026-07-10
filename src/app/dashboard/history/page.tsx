import { CalendarClock, ImageIcon, RotateCcw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requireRole } from "@/lib/auth"
import { formatShanghaiDate } from "@/lib/dates"
import { prisma } from "@/lib/prisma"
import { publicUploadUrl } from "@/lib/uploads"

export default async function HistoryPage() {
  const user = await requireRole(["ADMIN", "USER"])
  const submissions = await prisma.submission.findMany({
    where: { userId: user.id, status: { in: ["SUBMITTED", "MAKEUP"] } },
    orderBy: { submittedAt: "desc" },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      occurrence: { include: { plan: { include: { group: true } } } },
    },
  })

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-20 sm:pb-6">
      <div><div className="mb-2 flex items-center gap-2 text-sm text-primary"><CalendarClock className="size-4" />个人打卡记录</div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">打卡历史</h1><p className="mt-1 text-muted-foreground">查看你已经提交的作业图片与补卡记录。</p></div>

      {submissions.length ? submissions.map((submission) => (
        <Card key={submission.id}>
          <CardHeader>
            <div className="flex items-start justify-between gap-3"><div><CardTitle className="text-lg">{submission.occurrence.plan.title}</CardTitle><CardDescription className="mt-1">{submission.occurrence.plan.group.name} · {formatShanghaiDate(submission.occurrence.checkInDate, { year: "numeric", month: "long", day: "numeric" })}</CardDescription></div><Badge variant={submission.status === "MAKEUP" ? "secondary" : "default"}>{submission.status === "MAKEUP" ? <RotateCcw /> : null}{submission.status === "MAKEUP" ? "补卡" : "准时"}</Badge></div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {submission.images.map((image) => <a key={image.id} href={publicUploadUrl(image.storageKey)} target="_blank" rel="noreferrer" className="aspect-square rounded-xl border bg-muted bg-cover bg-center" style={{ backgroundImage: `url(${JSON.stringify(publicUploadUrl(image.storageKey))})` }} aria-label={`查看图片 ${image.originalName}`} />)}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground"><span className="inline-flex items-center gap-1"><ImageIcon className="size-4" />{submission.images.length} 张图片</span><span>提交于 {submission.submittedAt ? formatShanghaiDate(submission.submittedAt, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }) : "—"}</span></div>
            {submission.note ? <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">备注：{submission.note}</p> : null}
          </CardContent>
        </Card>
      )) : (
        <Card className="border-dashed"><CardContent className="flex min-h-72 items-center justify-center text-center"><div><CalendarClock className="mx-auto mb-3 size-10 text-muted-foreground" /><p className="font-medium">还没有打卡记录</p><p className="mt-1 text-sm text-muted-foreground">完成第一次作业提交后会显示在这里。</p></div></CardContent></Card>
      )}
    </div>
  )
}
