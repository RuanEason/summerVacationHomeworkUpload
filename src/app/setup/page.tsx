import { redirect } from "next/navigation"
import { CheckCircle2, Database, ShieldCheck, Users } from "lucide-react"

import { SetupForm } from "@/components/auth/setup-form"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { isSystemInitialized } from "@/lib/system"

const steps = [
  { icon: Database, label: "连接数据库", done: true },
  { icon: ShieldCheck, label: "创建 ROOT", done: false },
  { icon: Users, label: "开始添加成员", done: false },
]

export default async function SetupPage() {
  if (await isSystemInitialized()) redirect("/login")

  return (
    <main className="min-h-svh bg-[radial-gradient(circle_at_top_left,var(--color-primary)/0.12,transparent_32%),linear-gradient(to_bottom_right,var(--color-background),var(--color-muted))] px-4 py-8 sm:px-6 lg:py-14">
      <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
        <section className="space-y-7 px-1 lg:px-6">
          <Badge variant="secondary" className="rounded-full px-3 py-1">首次启动向导</Badge>
          <div className="space-y-4">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">欢迎使用暑假作业打卡系统</h1>
            <p className="max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              先创建唯一的 ROOT 管理员。完成后即可建立小组、添加管理员和学生，并配置每日打卡规则。
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {steps.map((step, index) => (
              <div key={step.label} className="flex items-center gap-3 rounded-xl border bg-card/70 p-3 shadow-xs backdrop-blur">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {step.done ? <CheckCircle2 className="size-5" /> : <step.icon className="size-5" />}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">步骤 {index + 1}</p>
                  <p className="font-medium">{step.label}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <Card className="border-border/70 shadow-xl shadow-primary/5">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl">初始化系统</CardTitle>
            <CardDescription>请妥善保存 ROOT 登录信息，密码会经过安全哈希后存储。</CardDescription>
          </CardHeader>
          <CardContent>
            <SetupForm />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
