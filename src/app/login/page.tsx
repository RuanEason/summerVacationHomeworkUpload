import { redirect } from "next/navigation"
import { ClipboardCheck, ImageUp, ShieldCheck } from "lucide-react"

import { LoginForm } from "@/components/auth/login-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentUser } from "@/lib/session"
import { getSystemConfig, isSystemInitialized } from "@/lib/system"

export default async function LoginPage() {
  if (!(await isSystemInitialized())) redirect("/setup")
  if (await getCurrentUser()) redirect("/dashboard")

  const config = await getSystemConfig()

  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      <section className="hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3 text-lg font-semibold">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary-foreground/15">
            <ClipboardCheck className="size-6" />
          </span>
          {config?.systemName}
        </div>
        <div className="max-w-lg space-y-6">
          <h1 className="text-4xl font-semibold leading-tight">每天一点进度，让整个暑假清晰可见。</h1>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-primary-foreground/10 p-4">
              <ImageUp className="mb-3 size-6" />
              <p className="font-medium">手机快捷打卡</p>
              <p className="mt-1 text-sm text-primary-foreground/75">微信中直接选择作业截图并提交</p>
            </div>
            <div className="rounded-2xl bg-primary-foreground/10 p-4">
              <ShieldCheck className="mb-3 size-6" />
              <p className="font-medium">分级权限管理</p>
              <p className="mt-1 text-sm text-primary-foreground/75">ROOT、管理员和学生各司其职</p>
            </div>
          </div>
        </div>
        <p className="text-sm text-primary-foreground/65">所有提交记录均按中国标准时间统计</p>
      </section>

      <section className="flex items-center justify-center bg-muted/30 px-4 py-10 sm:px-8">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-2 text-center lg:text-left">
            <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground lg:hidden">
              <ClipboardCheck className="size-7" />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">欢迎回来</h1>
            <p className="text-muted-foreground">登录后进入你的打卡主页或管理看板</p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>账号登录</CardTitle>
              <CardDescription>请输入 ROOT 或管理员分配的账号信息</CardDescription>
            </CardHeader>
            <CardContent>
              <LoginForm />
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  )
}
