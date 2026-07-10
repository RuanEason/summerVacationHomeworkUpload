import { redirect } from "next/navigation"
import { KeyRound } from "lucide-react"

import { ChangePasswordForm } from "@/components/auth/change-password-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requireUser } from "@/lib/auth"

export default async function ChangePasswordPage() {
  const user = await requireUser()
  if (!user.mustChangePassword) redirect("/dashboard")

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><KeyRound className="size-6" /></div>
          <CardTitle className="text-2xl">修改初始密码</CardTitle>
          <CardDescription>{user.displayName}，首次登录需要设置一个只有你知道的新密码。</CardDescription>
        </CardHeader>
        <CardContent><ChangePasswordForm /></CardContent>
      </Card>
    </main>
  )
}
