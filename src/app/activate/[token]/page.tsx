import { Clock3, KeyRound } from "lucide-react"

import { ActivationForm } from "@/components/users/activation-form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { prisma } from "@/lib/prisma"
import { getSystemConfig } from "@/lib/system"
import { hashOpaqueToken } from "@/lib/tokens"

export default async function ActivatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const [invitation, config] = await Promise.all([
    prisma.invitation.findUnique({
      where: { tokenHash: hashOpaqueToken(token) },
      include: { user: true },
    }),
    getSystemConfig(),
  ])
  const valid = invitation?.status === "PENDING" && invitation.expiresAt > new Date() && invitation.user.status === "PENDING"

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center">
          <Badge variant="secondary" className="mb-4">{config?.systemName ?? "作业打卡"}</Badge>
          <h1 className="text-3xl font-semibold tracking-tight">激活你的账号</h1>
          <p className="mt-2 text-muted-foreground">设置密码后即可进入打卡系统</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><KeyRound className="size-5" />账号初始化</CardTitle>
            <CardDescription>
              {valid ? `${invitation.user.displayName}，你的用户名是 ${invitation.user.username}` : "请检查管理员发送的链接"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {valid ? (
              <ActivationForm token={token} />
            ) : (
              <Alert variant="destructive">
                <Clock3 />
                <AlertTitle>链接无法使用</AlertTitle>
                <AlertDescription>该激活链接不存在、已经使用或超过 72 小时有效期，请联系 ROOT 重新创建。</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
