import { AlertCircle, CheckCircle2, ClipboardCheck, Clock3, RotateCcw, ShieldCheck, UserCog, Users } from "lucide-react"
import { redirect } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requireUser } from "@/lib/auth"
import { dateKeyToDatabaseDate, formatShanghaiDate, getShanghaiDateKey } from "@/lib/dates"
import { prisma } from "@/lib/prisma"

export default async function DashboardPage() {
  const user = await requireUser()

  if (user.role === "ADMIN") {
    const todayKey = getShanghaiDateKey()
    const [groups, todayOccurrences, recentSubmissions] = await Promise.all([
      prisma.group.findMany({
        where: { ownerAdminId: user.id, isActive: true },
        include: { _count: { select: { members: true, plans: true } } },
      }),
      prisma.checkInOccurrence.findMany({
        where: {
          checkInDate: dateKeyToDatabaseDate(todayKey),
          plan: { status: "ACTIVE", group: { ownerAdminId: user.id } },
        },
        include: {
          submissions: { where: { status: { in: ["SUBMITTED", "MAKEUP"] } } },
          plan: { include: { group: { include: { _count: { select: { members: true } } } } } },
        },
      }),
      prisma.submission.findMany({
        where: {
          status: { in: ["SUBMITTED", "MAKEUP"] },
          occurrence: { plan: { group: { ownerAdminId: user.id } } },
        },
        take: 6,
        orderBy: { submittedAt: "desc" },
        include: { user: true, occurrence: { include: { plan: true } } },
      }),
    ])

    const expected = todayOccurrences.reduce((sum, occurrence) => sum + occurrence.plan.group._count.members, 0)
    const submitted = todayOccurrences.reduce((sum, occurrence) => sum + occurrence.submissions.length, 0)
    const makeup = todayOccurrences.reduce((sum, occurrence) => sum + occurrence.submissions.filter((item) => item.status === "MAKEUP").length, 0)
    const memberCount = groups.reduce((sum, group) => sum + group._count.members, 0)

    return (
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><div className="mb-2 flex items-center gap-2 text-sm text-primary"><ShieldCheck className="size-4" />ADMIN 小组管理</div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">小组总览</h1><p className="mt-1 text-muted-foreground">{formatShanghaiDate(new Date(), { year: "numeric", month: "long", day: "numeric", weekday: "long" })}</p></div>
          <Badge variant="secondary" className="w-fit">负责 {groups.length} 个小组</Badge>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { title: "打卡成员", value: memberCount, note: "当前参与打卡人数", icon: Users },
            { title: "今日应提交", value: expected, note: todayOccurrences.length ? `${todayOccurrences.length} 个今日任务` : "今天没有打卡任务", icon: Clock3 },
            { title: "今日已提交", value: submitted, note: expected ? `完成率 ${Math.round(submitted / expected * 100)}%` : "等待任务开始", icon: CheckCircle2 },
            { title: "今日未提交", value: Math.max(expected - submitted, 0), note: makeup ? `其中 ${makeup} 次为补卡` : "包含尚未到截止时间", icon: AlertCircle },
          ].map((stat) => <Card key={stat.title}><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{stat.title}</CardTitle><stat.icon className="size-4 text-muted-foreground" /></CardHeader><CardContent><p className="text-3xl font-semibold tabular-nums">{stat.value}</p><p className="mt-1 text-xs text-muted-foreground">{stat.note}</p></CardContent></Card>)}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
          <Card>
            <CardHeader><CardTitle>我的小组</CardTitle><CardDescription>成员与打卡计划配置概况</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {groups.length ? groups.map((group) => <div key={group.id} className="flex items-center justify-between rounded-xl border p-4"><div><p className="font-medium">{group.name}</p><p className="mt-1 text-sm text-muted-foreground">{group._count.members} 名成员 · {group._count.plans} 个规则</p></div><Badge variant="outline">使用中</Badge></div>) : <div className="flex min-h-44 items-center justify-center text-center"><div><Users className="mx-auto mb-2 size-8 text-muted-foreground" /><p className="font-medium">尚未分配小组</p><p className="text-sm text-muted-foreground">请联系 ROOT 将小组分配给你。</p></div></div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>最近提交</CardTitle><CardDescription>组员最新的作业打卡记录</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {recentSubmissions.length ? recentSubmissions.map((submission) => <div key={submission.id} className="flex items-center gap-3 rounded-lg border p-3"><div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">{submission.status === "MAKEUP" ? <RotateCcw className="size-4" /> : <ClipboardCheck className="size-4" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{submission.user.displayName} · {submission.occurrence.plan.title}</p><p className="text-xs text-muted-foreground">{submission.submittedAt ? formatShanghaiDate(submission.submittedAt, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }) : "草稿"}</p></div><Badge variant={submission.status === "MAKEUP" ? "secondary" : "default"}>{submission.status === "MAKEUP" ? "补卡" : "准时"}</Badge></div>) : <p className="py-12 text-center text-sm text-muted-foreground">还没有组员提交记录</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (user.role === "USER") {
    redirect("/dashboard/check-in")
  }

  const [userCount, adminCount, groupCount, pendingCount] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE" } }),
    prisma.group.count({ where: { isActive: true } }),
    prisma.user.count({ where: { status: "PENDING" } }),
  ])

  const stats = [
    { title: "全部用户", value: userCount, description: "包含 ROOT、管理员和学生", icon: Users },
    { title: "管理员", value: adminCount, description: "当前启用的 ADMIN", icon: UserCog },
    { title: "活跃小组", value: groupCount, description: "正在使用的打卡小组", icon: ClipboardCheck },
    { title: "待激活账号", value: pendingCount, description: "尚未完成密码设置", icon: Clock3 },
  ]

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-primary">
            <ShieldCheck className="size-4" />
            ROOT 全局管理
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">系统总览</h1>
          <p className="mt-1 text-muted-foreground">管理用户、小组，并查看全局打卡进度。</p>
        </div>
        <Badge variant="secondary" className="w-fit">系统运行正常</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tabular-nums">{stat.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader>
            <CardTitle>今日打卡概况</CardTitle>
            <CardDescription>创建小组和打卡规则后，这里将展示准时、补卡和缺卡趋势。</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed bg-muted/25 text-center">
              <div className="max-w-sm space-y-2 px-6">
                <ClipboardCheck className="mx-auto size-9 text-muted-foreground" />
                <p className="font-medium">还没有打卡数据</p>
                <p className="text-sm text-muted-foreground">下一步请创建管理员、分配小组并设置打卡计划。</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>待办事项</CardTitle>
            <CardDescription>完成系统启用前的基础配置</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {["创建第一个 ADMIN", "建立学生小组", "配置暑假打卡规则"].map((item, index) => (
              <div key={item} className="flex items-center gap-3 rounded-lg border p-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">{index + 1}</span>
                <span className="text-sm font-medium">{item}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
