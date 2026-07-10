"use client"

import { useActionState } from "react"
import { LoaderCircle, ShieldCheck } from "lucide-react"

import { initializeSystem, type AuthActionState } from "@/app/actions/auth"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const initialState: AuthActionState = {}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null
  return <p className="text-sm text-destructive">{messages[0]}</p>
}

export function SetupForm() {
  const [state, action, pending] = useActionState(initializeSystem, initialState)

  return (
    <form action={action} className="space-y-5">
      {state.message ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="systemName">系统名称</Label>
        <Input id="systemName" name="systemName" defaultValue="暑假作业打卡" autoComplete="organization" />
        <FieldError messages={state.errors?.systemName} />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="displayName">ROOT 姓名</Label>
          <Input id="displayName" name="displayName" placeholder="例如：张老师" autoComplete="name" />
          <FieldError messages={state.errors?.displayName} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="username">登录用户名</Label>
          <Input id="username" name="username" placeholder="例如：root" autoCapitalize="none" autoComplete="username" />
          <FieldError messages={state.errors?.username} />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="password">登录密码</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" />
          <FieldError messages={state.errors?.password} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">确认密码</Label>
          <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" />
          <FieldError messages={state.errors?.confirmPassword} />
        </div>
      </div>

      <div className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
          <p>ROOT 是系统最高权限账号。初始化完成后，本页面将自动关闭，后续用户均由 ROOT 创建。</p>
        </div>
      </div>

      <Button className="h-11 w-full text-base" disabled={pending} type="submit">
        {pending ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />}
        {pending ? "正在初始化…" : "创建系统并进入后台"}
      </Button>
    </form>
  )
}
