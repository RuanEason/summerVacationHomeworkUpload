"use client"

import { useActionState } from "react"
import { KeyRound, LoaderCircle } from "lucide-react"

import { changeInitialPassword, type AuthActionState } from "@/app/actions/auth"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const initialState: AuthActionState = {}

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changeInitialPassword, initialState)

  return (
    <form action={action} className="space-y-5">
      {state.message ? <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert> : null}
      <div className="space-y-2">
        <Label htmlFor="password">新密码</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" />
        {state.errors?.password?.[0] ? <p className="text-sm text-destructive">{state.errors.password[0]}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">确认新密码</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" />
        {state.errors?.confirmPassword?.[0] ? <p className="text-sm text-destructive">{state.errors.confirmPassword[0]}</p> : null}
      </div>
      <Button className="h-11 w-full text-base" disabled={pending} type="submit">
        {pending ? <LoaderCircle className="animate-spin" /> : <KeyRound />}
        {pending ? "正在保存…" : "保存新密码并继续"}
      </Button>
    </form>
  )
}
