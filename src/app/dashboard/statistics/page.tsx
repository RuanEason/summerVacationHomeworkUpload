import Link from "next/link"
import { BarChart3, CheckCircle2, Download, RotateCcw, TrendingUp, Users, XCircle } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { requireRole } from "@/lib/auth"
import { addDaysToDateKey, dateKeyToDatabaseDate, getShanghaiDateKey } from "@/lib/dates"
import { prisma } from "@/lib/prisma"

const allowedDays = [7, 30, 90] as const

export default async function StatisticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  await requireRole(["ROOT"])
  const requestedDays = Number((await searchParams).days)
  const days = allowedDays.includes(requestedDays as typeof allowedDays[number]) ? requestedDays : 30
  const todayKey = getShanghaiDateKey()
  const since = dateKeyToDatabaseDate(addDaysToDateKey(todayKey, -(days - 1)))

  const [groups, totalUsers, activeAdmins] = await Promise.all([
    prisma.group.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: {
        ownerAdmin: true,
        members: { where: { participatesInCheckIn: true }, select: { id: true } },
        plans: {
          select: {
            occurrences: {
              where: { checkInDate: { gte: since } },
              select: {
                id: true,
                submissions: {
                  where: { status: { in: ["SUBMITTED", "MAKEUP"] } },
                  select: { id: true, status: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE" } }),
  ])

  const groupMetrics = groups.map((group) => {
    const occurrences = group.plans.flatMap((plan) => plan.occurrences)
    const expected = occurrences.length * group.members.length
    const submitted = occurrences.reduce((sum, occurrence) => sum + occurrence.submissions.length, 0)
    const makeup = occurrences.reduce((sum, occurrence) => sum + occurrence.submissions.filter((submission) => submission.status === "MAKEUP").length, 0)
    return {
      id: group.id,
      name: group.name,
      adminName: group.ownerAdmin.displayName,
      members: group.members.length,
      tasks: occurrences.length,
      expected,
      submitted,
      makeup,
      missing: Math.max(expected - submitted, 0),
      completionRate: expected ? Math.min(Math.round(submitted / expected * 100), 100) : 0,
    }
  }).sort((a, b) => b.completionRate - a.completionRate || b.submitted - a.submitted)

  const totals = groupMetrics.reduce((result, group) => ({
    members: result.members + group.members,
    expected: result.expected + group.expected,
    submitted: result.submitted + group.submitted,
    makeup: result.makeup + group.makeup,
    missing: result.missing + group.missing,
  }), { members: 0, expected: 0, submitted: 0, makeup: 0, missing: 0 })
  const completionRate = totals.expected ? Math.min(Math.round(totals.submitted / totals.expected * 100), 100) : 0

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><div className="mb-2 flex items-center gap-2 text-sm text-primary"><BarChart3 className="size-4" />ROOT 全局统计</div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">全局统计</h1><p className="mt-1 text-muted-foreground">按当前小组成员计算最近 {days} 天的打卡完成情况。</p></div>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-lg border p-1">{allowedDays.map((value) => <Button key={value} variant={days === value ? "secondary" : "ghost"} size="sm" asChild><Link href={`/dashboard/statistics?days=${value}`}>{value} 天</Link></Button>)}</div>
          <Button variant="outline" asChild><a href={`/api/exports/submissions?days=${days}`}><Download />导出 Excel</a></Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { title: "活跃用户", value: totalUsers, note: `其中 ${activeAdmins} 名管理员`, icon: Users },
          { title: "应打卡次数", value: totals.expected, note: `${groups.length} 个活跃小组`, icon: TrendingUp },
          { title: "已提交", value: totals.submitted, note: `整体完成率 ${completionRate}%`, icon: CheckCircle2 },
          { title: "补卡次数", value: totals.makeup, note: "已包含在提交次数中", icon: RotateCcw },
          { title: "未提交", value: totals.missing, note: "包含尚未到期任务", icon: XCircle },
        ].map((item) => <Card key={item.title}><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{item.title}</CardTitle><item.icon className="size-4 text-muted-foreground" /></CardHeader><CardContent><p className="text-3xl font-semibold tabular-nums">{item.value}</p><p className="mt-1 text-xs text-muted-foreground">{item.note}</p></CardContent></Card>)}
      </div>

      <Card>
        <CardHeader><CardTitle>小组完成率</CardTitle><CardDescription>完成率按“已提交次数 ÷ 应提交次数”计算，补卡计入已提交。</CardDescription></CardHeader>
        <CardContent className="px-0 sm:px-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>小组</TableHead><TableHead>管理员</TableHead><TableHead>成员/任务</TableHead><TableHead>已提交</TableHead><TableHead>补卡</TableHead><TableHead>未提交</TableHead><TableHead className="min-w-52">完成率</TableHead></TableRow></TableHeader>
              <TableBody>
                {groupMetrics.length ? groupMetrics.map((group) => <TableRow key={group.id}><TableCell className="font-medium">{group.name}</TableCell><TableCell>{group.adminName}</TableCell><TableCell>{group.members} 人 / {group.tasks} 次</TableCell><TableCell>{group.submitted}</TableCell><TableCell>{group.makeup}</TableCell><TableCell>{group.missing}</TableCell><TableCell><div className="flex items-center gap-3"><div className="h-2 min-w-28 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${group.completionRate}%` }} /></div><Badge variant={group.completionRate >= 80 ? "default" : group.completionRate >= 50 ? "secondary" : "outline"}>{group.completionRate}%</Badge></div></TableCell></TableRow>) : <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">还没有可以统计的小组</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
