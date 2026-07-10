import { Ban, Clock3, ShieldCheck, Trash2, UserCheck, Users } from "lucide-react"

import { deletePendingUser, toggleUserStatus } from "@/app/actions/users"
import { CreateUserForms } from "@/components/users/create-user-forms"
import { BulkImportCard } from "@/components/users/bulk-import-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { requireRole } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const roleNames = { ROOT: "ROOT", ADMIN: "管理员", USER: "普通用户" } as const
const statusNames = { ACTIVE: "已启用", PENDING: "待激活", DISABLED: "已停用" } as const
const statusVariants = { ACTIVE: "default", PENDING: "secondary", DISABLED: "destructive" } as const

export default async function UsersPage() {
  const currentUser = await requireRole(["ROOT"])
  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { createdAt: "desc" }],
    include: { groupMemberships: { include: { group: true } } },
  })

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div>
        <div className="mb-2 flex items-center gap-2 text-sm text-primary"><Users className="size-4" />ROOT 用户管理</div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">用户管理</h1>
        <p className="mt-1 text-muted-foreground">创建管理员和普通用户，管理账号状态与激活方式。</p>
      </div>

      <CreateUserForms />
      <BulkImportCard />

      <Card>
        <CardHeader>
          <CardTitle>全部用户</CardTitle>
          <CardDescription>已创建 {users.length} 个账号。为保留打卡历史，已激活账号使用停用代替物理删除。</CardDescription>
        </CardHeader>
        <CardContent className="px-0 sm:px-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>所属小组</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="font-medium">{user.displayName}</div>
                      <div className="text-xs text-muted-foreground">{user.username}</div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5">
                        {user.role === "ROOT" ? <ShieldCheck className="size-4 text-primary" /> : null}
                        {roleNames[user.role]}
                      </span>
                    </TableCell>
                    <TableCell><Badge variant={statusVariants[user.status]}>{statusNames[user.status]}</Badge></TableCell>
                    <TableCell>{user.groupMemberships[0]?.group.name ?? <span className="text-muted-foreground">未分组</span>}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{user.createdAt.toLocaleDateString("zh-CN")}</TableCell>
                    <TableCell className="text-right">
                      {user.status === "PENDING" ? (
                        <form action={deletePendingUser.bind(null, user.id)}>
                          <Button variant="ghost" size="sm" type="submit"><Trash2 />删除</Button>
                        </form>
                      ) : user.role !== "ROOT" && user.id !== currentUser.id ? (
                        <form action={toggleUserStatus.bind(null, user.id)}>
                          <Button variant="ghost" size="sm" type="submit">
                            {user.status === "ACTIVE" ? <Ban /> : <UserCheck />}
                            {user.status === "ACTIVE" ? "停用" : "启用"}
                          </Button>
                        </form>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="size-3" />受保护</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
