"use client"

import { useActionState } from "react"
import { LoaderCircle, LogIn } from "lucide-react"

import { login, type AuthActionState } from "@/app/actions/auth"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const initialState: AuthActionState = {}

export function LoginForm() {
  const [state, action, pending] = useActionState(login, initialState)

  return (
    <form action={action} className="space-y-5">
      {state.message ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="username">用户名</Label>
        <Input id="username" name="username" autoComplete="username" autoCapitalize="none" placeholder="请输入用户名" />
        {state.errors?.username?.[0] ? <p className="text-sm text-destructive">{state.errors.username[0]}</p> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">密码</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" placeholder="请输入密码" />
        {state.errors?.password?.[0] ? <p className="text-sm text-destructive">{state.errors.password[0]}</p> : null}
      </div>

      <Button className="h-11 w-full text-base" disabled={pending} type="submit">
        {pending ? <LoaderCircle className="animate-spin" /> : <LogIn />}
        {pending ? "正在登录…" : "登录"}
      </Button>
    </form>
  )
}
