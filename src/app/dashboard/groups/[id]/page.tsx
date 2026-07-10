import Link from "next/link"
import { ArrowLeft, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react"
import { notFound } from "next/navigation"

import { addGroupMember, removeGroupMember } from "@/app/actions/groups"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { requireRole } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export default async function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["ROOT"])
  const { id } = await params
  const [group, candidates] = await Promise.all([
    prisma.group.findUnique({
      where: { id },
      include: { ownerAdmin: true, members: { orderBy: { joinedAt: "asc" }, include: { user: true } } },
    }),
    prisma.user.findMany({
      where: {
        status: "ACTIVE",
        role: { in: ["ADMIN", "USER"] },
        groupMemberships: { none: {} },
      },
      orderBy: [{ role: "asc" }, { displayName: "asc" }],
      select: { id: true, displayName: true, username: true, role: true },
    }),
  ])

  if (!group) notFound()

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-3 -ml-2"><Link href="/dashboard/groups"><ArrowLeft />返回小组列表</Link></Button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{group.name}</h1><p className="mt-1 text-muted-foreground">管理员：{group.ownerAdmin.displayName}（{group.ownerAdmin.username}）</p></div>
          <Badge variant="secondary" className="w-fit">{group.members.length} 名打卡成员</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserPlus className="size-5" />添加组员</CardTitle>
          <CardDescription>每个用户目前只能属于一个小组；ADMIN 也可以作为组员参与打卡。</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={addGroupMember.bind(null, group.id)} className="flex flex-col gap-3 sm:flex-row">
            <select name="userId" defaultValue="" className="flex h-9 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
              <option value="" disabled>选择未分组的用户</option>
              {candidates.map((user) => <option key={user.id} value={user.id}>{user.displayName}（{user.username}）· {user.role === "ADMIN" ? "管理员" : "普通用户"}</option>)}
            </select>
            <Button type="submit" disabled={candidates.length === 0}><UserPlus />加入小组</Button>
          </form>
          {candidates.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">当前没有可加入的已激活用户。</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>小组成员</CardTitle><CardDescription>移出成员不会删除其历史打卡记录。</CardDescription></CardHeader>
        <CardContent className="px-0 sm:px-6">
          {group.members.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>成员</TableHead><TableHead>角色</TableHead><TableHead>加入时间</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
                <TableBody>
                  {group.members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell><p className="font-medium">{member.user.displayName}</p><p className="text-xs text-muted-foreground">{member.user.username}</p></TableCell>
                      <TableCell>{member.user.role === "ADMIN" ? <span className="inline-flex items-center gap-1"><ShieldCheck className="size-4 text-primary" />管理员</span> : "普通用户"}</TableCell>
                      <TableCell className="text-muted-foreground">{member.joinedAt.toLocaleDateString("zh-CN")}</TableCell>
                      <TableCell className="text-right"><form action={removeGroupMember.bind(null, group.id, member.userId)}><Button variant="ghost" size="sm" type="submit"><Trash2 />移出</Button></form></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex min-h-48 items-center justify-center text-center"><div><Users className="mx-auto mb-2 size-8 text-muted-foreground" /><p className="font-medium">暂无成员</p><p className="text-sm text-muted-foreground">从上方选择用户加入小组。</p></div></div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
