import { FileClock } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { requireRole } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export default async function AuditLogsPage() {
  await requireRole(["ROOT"])
  const logs = await prisma.auditLog.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    include: { actor: true },
  })

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div><div className="mb-2 flex items-center gap-2 text-sm text-primary"><FileClock className="size-4" />ROOT 安全审计</div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">操作日志</h1><p className="mt-1 text-muted-foreground">展示最近 100 条关键管理操作。</p></div>
      <Card>
        <CardHeader><CardTitle>最近操作</CardTitle><CardDescription>用户创建、状态变更、小组调整等操作会自动记录。</CardDescription></CardHeader>
        <CardContent className="px-0 sm:px-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>时间</TableHead><TableHead>操作人</TableHead><TableHead>动作</TableHead><TableHead>说明</TableHead></TableRow></TableHeader>
              <TableBody>
                {logs.map((log) => <TableRow key={log.id}><TableCell className="whitespace-nowrap text-muted-foreground">{log.createdAt.toLocaleString("zh-CN", { hour12: false })}</TableCell><TableCell>{log.actor?.displayName ?? "系统"}</TableCell><TableCell className="font-mono text-xs">{log.action}</TableCell><TableCell>{log.summary ?? "—"}</TableCell></TableRow>)}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
