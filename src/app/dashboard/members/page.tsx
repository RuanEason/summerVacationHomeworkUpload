import { ShieldCheck, Trash2, UserPlus, Users } from "lucide-react"

import { addAdminMember, removeAdminMember } from "@/app/actions/admin"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { requireRole } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export default async function MembersPage() {
  const admin = await requireRole(["ADMIN"])
  const groups = await prisma.group.findMany({
    where: { ownerAdminId: admin.id, isActive: true },
    orderBy: { createdAt: "asc" },
    include: { members: { orderBy: { joinedAt: "asc" }, include: { user: true } } },
  })
  const ungroupedUsers = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      OR: [{ role: "USER" }, { id: admin.id }],
      groupMemberships: { none: {} },
    },
    orderBy: { displayName: "asc" },
    select: { id: true, displayName: true, username: true, role: true },
  })

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div><div className="mb-2 flex items-center gap-2 text-sm text-primary"><Users className="size-4" />ADMIN 小组管理</div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">我的组员</h1><p className="mt-1 text-muted-foreground">选择尚未分组的普通用户，也可以把自己加入打卡名单。</p></div>

      {groups.length ? groups.map((group) => (
        <Card key={group.id}>
          <CardHeader>
            <div className="flex items-start justify-between gap-3"><div><CardTitle>{group.name}</CardTitle><CardDescription className="mt-1">当前 {group.members.length} 名打卡成员</CardDescription></div><Badge variant="secondary">我负责的小组</Badge></div>
          </CardHeader>
          <CardContent className="space-y-5">
            <form action={addAdminMember.bind(null, group.id)} className="flex flex-col gap-3 sm:flex-row">
              <select name="userId" defaultValue="" className="flex h-9 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
                <option value="" disabled>选择未分组用户</option>
                {ungroupedUsers.map((user) => <option key={user.id} value={user.id}>{user.displayName}（{user.username}）{user.id === admin.id ? " · 我自己" : ""}</option>)}
              </select>
              <Button type="submit" disabled={ungroupedUsers.length === 0}><UserPlus />加入小组</Button>
            </form>
            <div className="overflow-x-auto rounded-xl border">
              <Table>
                <TableHeader><TableRow><TableHead>组员</TableHead><TableHead>身份</TableHead><TableHead>打卡要求</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
                <TableBody>
                  {group.members.length ? group.members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell><p className="font-medium">{member.user.displayName}</p><p className="text-xs text-muted-foreground">{member.user.username}</p></TableCell>
                      <TableCell>{member.user.role === "ADMIN" ? <span className="inline-flex items-center gap-1"><ShieldCheck className="size-4 text-primary" />管理员本人</span> : "普通用户"}</TableCell>
                      <TableCell><Badge variant={member.participatesInCheckIn ? "default" : "secondary"}>{member.participatesInCheckIn ? "需要打卡" : "不参与"}</Badge></TableCell>
                      <TableCell className="text-right"><form action={removeAdminMember.bind(null, group.id, member.userId)}><Button variant="ghost" size="sm" type="submit"><Trash2 />移出</Button></form></TableCell>
                    </TableRow>
                  )) : <TableRow><TableCell colSpan={4} className="h-28 text-center text-muted-foreground">小组还没有打卡成员</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )) : (
        <Card className="border-dashed"><CardContent className="flex min-h-64 items-center justify-center text-center"><div><Users className="mx-auto mb-2 size-9 text-muted-foreground" /><p className="font-medium">ROOT 尚未给你分配小组</p><p className="mt-1 text-sm text-muted-foreground">请先联系 ROOT 创建小组并指定你为管理员。</p></div></CardContent></Card>
      )}
    </div>
  )
}
