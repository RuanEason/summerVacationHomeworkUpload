import { Archive, CalendarDays, ImageIcon, Pause, Play, RotateCcw } from "lucide-react"

import { archiveCheckInPlan, toggleCheckInPlan } from "@/app/actions/admin"
import { CreatePlanForm } from "@/components/admin/create-plan-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requireRole } from "@/lib/auth"
import { formatShanghaiDate, minutesToTime } from "@/lib/dates"
import { prisma } from "@/lib/prisma"

const weekdayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]

export default async function RulesPage() {
  const viewer = await requireRole(["ROOT", "ADMIN"])
  const groupScope = viewer.role === "ROOT" ? {} : { ownerAdminId: viewer.id }
  const groups = await prisma.group.findMany({
    where: { ...groupScope, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  })
  const plans = await prisma.checkInPlan.findMany({
    where: viewer.role === "ROOT" ? {} : { group: { ownerAdminId: viewer.id } },
    orderBy: { createdAt: "desc" },
    include: { group: true, _count: { select: { occurrences: true } } },
  })

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div><div className="mb-2 flex items-center gap-2 text-sm text-primary"><CalendarDays className="size-4" />{viewer.role === "ROOT" ? "ROOT 全局规则" : "ADMIN 规则配置"}</div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">打卡规则</h1><p className="mt-1 text-muted-foreground">设置打卡日期、图片数量和补卡期限。规则创建后会生成固定的每日任务快照。</p></div>

      <Card><CardHeader><CardTitle>创建打卡规则</CardTitle><CardDescription>修改新规则不会影响已有历史任务和提交记录。</CardDescription></CardHeader><CardContent>{groups.length ? <CreatePlanForm groups={groups} /> : <p className="text-sm text-muted-foreground">ROOT 尚未给你分配小组，暂时不能创建规则。</p>}</CardContent></Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {plans.map((plan) => {
          const weekdays = Array.isArray(plan.weekdays) ? (plan.weekdays as number[]) : []
          return (
            <Card key={plan.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3"><div><CardTitle>{plan.title}</CardTitle><CardDescription className="mt-1">{plan.group.name}</CardDescription></div><Badge variant={plan.status === "ACTIVE" ? "default" : "secondary"}>{plan.status === "ACTIVE" ? "已启用" : plan.status === "PAUSED" ? "已暂停" : "已归档"}</Badge></div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div className="rounded-lg bg-muted/50 p-3"><p className="text-muted-foreground">日期范围</p><p className="mt-1 font-medium">{formatShanghaiDate(plan.startDate)} 至 {formatShanghaiDate(plan.endDate)}</p></div>
                  <div className="rounded-lg bg-muted/50 p-3"><p className="text-muted-foreground">打卡时间</p><p className="mt-1 font-medium">{minutesToTime(plan.openTimeMinutes)}–{minutesToTime(plan.dueTimeMinutes)}</p></div>
                  <div className="rounded-lg bg-muted/50 p-3"><p className="text-muted-foreground">图片要求</p><p className="mt-1 inline-flex items-center gap-1 font-medium"><ImageIcon className="size-4" />{plan.requiredImageCount} 张</p></div>
                  <div className="rounded-lg bg-muted/50 p-3"><p className="text-muted-foreground">每日任务</p><p className="mt-1 font-medium">{plan._count.occurrences} 个</p></div>
                </div>
                <div className="flex flex-wrap gap-2">{weekdays.map((day) => <Badge key={day} variant="outline">{weekdayNames[day]}</Badge>)}{plan.allowMakeup ? <Badge variant="outline"><RotateCcw />可补 {plan.makeupDays} 天</Badge> : null}</div>
                {["ACTIVE", "PAUSED"].includes(plan.status) ? <div className="flex flex-wrap gap-2"><form action={toggleCheckInPlan.bind(null, plan.id)}><Button variant="outline" size="sm" type="submit">{plan.status === "ACTIVE" ? <Pause /> : <Play />}{plan.status === "ACTIVE" ? "暂停规则" : "重新启用"}</Button></form><form action={archiveCheckInPlan.bind(null, plan.id)}><Button variant="destructive" size="sm" type="submit"><Archive />归档规则</Button></form></div> : null}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
