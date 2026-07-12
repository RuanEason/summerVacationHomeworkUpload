import Link from "next/link"
import { CheckCircle2, ClipboardCheck, Clock3, Download, Eye, RotateCcw, XCircle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { requireRole } from "@/lib/auth"
import { getCheckInAvailableAt, isEarlyCheckIn } from "@/lib/check-in-window"
import { formatShanghaiDate } from "@/lib/dates"
import { prisma } from "@/lib/prisma"

type DisplayStatus = "early" | "submitted" | "makeup" | "pending" | "available-makeup" | "missing" | "not-open" | "paused"

function getDisplayStatus(
  occurrence: { opensAt: Date; dueAt: Date; makeupUntil: Date | null },
  submission: { status: string; submittedAt: Date | null } | undefined,
  planStatus: string,
  earlyCheckInSettings: { allowEarlyCheckIn: boolean; earlyCheckInDays: number },
  now: Date
): DisplayStatus {
  if (submission?.status === "MAKEUP") return "makeup"
  if (submission?.status === "SUBMITTED") return isEarlyCheckIn(submission.submittedAt, occurrence.opensAt) ? "early" : "submitted"
  if (planStatus === "PAUSED") return "paused"
  if (now < getCheckInAvailableAt(occurrence.opensAt, earlyCheckInSettings)) return "not-open"
  if (now <= occurrence.dueAt) return "pending"
  if (occurrence.makeupUntil && now <= occurrence.makeupUntil) return "available-makeup"
  return "missing"
}

const statusMeta = {
  early: { label: "提前打卡", variant: "default" as const, icon: CheckCircle2 },
  submitted: { label: "已提交", variant: "default" as const, icon: CheckCircle2 },
  makeup: { label: "已补卡", variant: "secondary" as const, icon: RotateCcw },
  pending: { label: "待提交", variant: "outline" as const, icon: Clock3 },
  "available-makeup": { label: "可补卡", variant: "secondary" as const, icon: RotateCcw },
  missing: { label: "缺卡", variant: "destructive" as const, icon: XCircle },
  "not-open": { label: "未开始", variant: "outline" as const, icon: Clock3 },
  paused: { label: "规则暂停", variant: "outline" as const, icon: Clock3 },
}

export default async function SubmissionsPage() {
  const viewer = await requireRole(["ROOT", "ADMIN"])
  const groupScope = viewer.role === "ROOT" ? {} : { ownerAdminId: viewer.id }
  const groups = await prisma.group.findMany({
    where: { ...groupScope, isActive: true },
    include: { members: { where: { participatesInCheckIn: true }, include: { user: true } } },
  })
  const occurrences = await prisma.checkInOccurrence.findMany({
    where: viewer.role === "ROOT" ? {} : { plan: { group: { ownerAdminId: viewer.id } } },
    take: 24,
    orderBy: [{ checkInDate: "desc" }, { createdAt: "desc" }],
    include: {
      plan: { include: { group: true } },
      submissions: { where: { status: { in: ["SUBMITTED", "MAKEUP"] } } },
    },
  })
  const membersByGroup = new Map(groups.map((group) => [group.id, group.members]))
  const now = new Date()

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><div className="mb-2 flex items-center gap-2 text-sm text-primary"><ClipboardCheck className="size-4" />{viewer.role === "ROOT" ? "ROOT 全局提交统计" : "ADMIN 提交统计"}</div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">提交记录</h1><p className="mt-1 text-muted-foreground">按每日任务查看每位组员的准时、补卡或缺卡状态。</p></div><Button variant="outline" asChild className="w-fit"><a href="/api/exports/submissions?days=30"><Download />导出近 30 天</a></Button></div>

      {occurrences.length ? occurrences.map((occurrence) => {
        const members = membersByGroup.get(occurrence.plan.groupId) ?? []
        const submissionsByUser = new Map(occurrence.submissions.map((submission) => [submission.userId, submission]))
        const submittedCount = occurrence.submissions.length
        return (
          <Card key={occurrence.id}>
            <CardHeader>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle>{occurrence.plan.title}</CardTitle><CardDescription className="mt-1">{occurrence.plan.group.name} · {formatShanghaiDate(occurrence.checkInDate, { year: "numeric", month: "long", day: "numeric", weekday: "short" })}</CardDescription></div><Badge variant="secondary">{submittedCount}/{members.length} 已提交</Badge></div>
            </CardHeader>
            <CardContent className="px-0 sm:px-6">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>成员</TableHead><TableHead>状态</TableHead><TableHead>提交时间</TableHead><TableHead>图片要求</TableHead><TableHead className="text-right">作业</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {members.length ? members.map((member) => {
                      const submission = submissionsByUser.get(member.userId)
                      const status = getDisplayStatus(occurrence, submission, occurrence.plan.status, occurrence.plan, now)
                      const meta = statusMeta[status]
                      return <TableRow key={member.id}><TableCell><p className="font-medium">{member.user.displayName}</p><p className="text-xs text-muted-foreground">{member.user.username}</p></TableCell><TableCell><Badge variant={meta.variant}><meta.icon />{meta.label}</Badge></TableCell><TableCell className="whitespace-nowrap text-muted-foreground">{submission?.submittedAt ? formatShanghaiDate(submission.submittedAt, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }) : "—"}</TableCell><TableCell>{occurrence.requiredImageCount}–{occurrence.maxImageCount} 张</TableCell><TableCell className="text-right">{submission ? <Button variant="ghost" size="sm" asChild><Link href={`/dashboard/submissions/${submission.id}`}><Eye />查看作业</Link></Button> : <span className="text-muted-foreground">—</span>}</TableCell></TableRow>
                    }) : <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">这个小组还没有打卡成员</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )
      }) : (
        <Card className="border-dashed"><CardContent className="flex min-h-72 items-center justify-center text-center"><div><ClipboardCheck className="mx-auto mb-3 size-10 text-muted-foreground" /><p className="font-medium">还没有每日打卡任务</p><p className="mt-1 text-sm text-muted-foreground">先在“打卡规则”中创建规则，系统会自动生成任务。</p></div></CardContent></Card>
      )}
    </div>
  )
}
