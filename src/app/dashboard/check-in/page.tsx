import { CalendarCheck2, Camera, CheckCircle2 } from "lucide-react"

import { CheckInTaskCard } from "@/components/check-in/check-in-task-card"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { requireRole } from "@/lib/auth"
import { getAvailableCheckInTasks } from "@/lib/check-in"
import { formatShanghaiDate } from "@/lib/dates"
import { prisma } from "@/lib/prisma"

export default async function CheckInPage() {
  const user = await requireRole(["ADMIN", "USER"])
  const [tasks, membership] = await Promise.all([
    getAvailableCheckInTasks(user.id),
    prisma.groupMember.findUnique({ where: { userId: user.id }, include: { group: true } }),
  ])

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 pb-20 sm:pb-6">
      <div>
        <Badge variant="secondary" className="mb-3"><CalendarCheck2 />{formatShanghaiDate(new Date(), { month: "long", day: "numeric", weekday: "long" })}</Badge>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">你好，{user.displayName}</h1>
        <p className="mt-1 text-muted-foreground">{membership ? `${membership.group.name} · 今天也要记得完成作业` : "你还没有加入打卡小组"}</p>
      </div>

      {tasks.length ? tasks.map((task) => <CheckInTaskCard key={task.id} task={task} />) : (
        <Card className="border-dashed">
          <CardContent className="flex min-h-72 items-center justify-center text-center">
            <div className="max-w-sm space-y-3 px-6">
              {membership ? <CheckCircle2 className="mx-auto size-11 text-primary" /> : <Camera className="mx-auto size-11 text-muted-foreground" />}
              <p className="text-lg font-medium">{membership ? "当前没有待打卡任务" : "尚未加入小组"}</p>
              <p className="text-sm leading-6 text-muted-foreground">{membership ? "今天可能不在打卡日内，或管理员尚未创建打卡规则。" : "请联系 ROOT 或 ADMIN 将你加入小组。"}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
