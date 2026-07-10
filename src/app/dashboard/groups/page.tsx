import Link from "next/link"
import { ArrowRight, ShieldCheck, Users } from "lucide-react"

import { CreateGroupForm } from "@/components/groups/create-group-form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requireRole } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export default async function GroupsPage() {
  await requireRole(["ROOT"])
  const [admins, groups] = await Promise.all([
    prisma.user.findMany({
      where: { role: "ADMIN", status: "ACTIVE" },
      orderBy: { displayName: "asc" },
      select: { id: true, displayName: true, username: true },
    }),
    prisma.group.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      include: { ownerAdmin: true, _count: { select: { members: true, plans: true } } },
    }),
  ])

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm text-primary"><Users className="size-4" />ROOT 小组管理</div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">管理员与小组</h1>
        <p className="mt-1 text-muted-foreground">为 ADMIN 建立小组，再添加需要打卡的普通用户。</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>创建小组</CardTitle>
            <CardDescription>小组创建后，ADMIN 只能管理自己负责的小组。</CardDescription>
          </CardHeader>
          <CardContent><CreateGroupForm admins={admins} /></CardContent>
        </Card>

        <div className="space-y-4">
          {groups.length ? groups.map((group) => (
            <Card key={group.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle>{group.name}</CardTitle>
                    <CardDescription className="mt-1">{group.description || "暂无小组说明"}</CardDescription>
                  </div>
                  <Badge variant="secondary">{group.isActive ? "使用中" : "已停用"}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="grid grid-cols-3 gap-5 text-sm">
                    <div><p className="text-muted-foreground">管理员</p><p className="mt-1 font-medium">{group.ownerAdmin.displayName}</p></div>
                    <div><p className="text-muted-foreground">成员</p><p className="mt-1 font-medium">{group._count.members} 人</p></div>
                    <div><p className="text-muted-foreground">打卡计划</p><p className="mt-1 font-medium">{group._count.plans} 个</p></div>
                  </div>
                  <Button variant="outline" asChild>
                    <Link href={`/dashboard/groups/${group.id}`}>管理成员<ArrowRight /></Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )) : (
            <Card className="border-dashed">
              <CardContent className="flex min-h-64 items-center justify-center text-center">
                <div className="space-y-2"><ShieldCheck className="mx-auto size-9 text-muted-foreground" /><p className="font-medium">还没有小组</p><p className="text-sm text-muted-foreground">创建并激活 ADMIN 后即可建立第一个小组。</p></div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
