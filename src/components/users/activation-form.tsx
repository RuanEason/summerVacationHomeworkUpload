"use client"

import { useActionState } from "react"
import { KeyRound, LoaderCircle } from "lucide-react"

import { activateUser, type UserActionState } from "@/app/actions/users"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const initialState: UserActionState = {}

export function ActivationForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(activateUser, initialState)

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="token" value={token} />
      {state.message ? (
        <Alert variant="destructive"><AlertDescription>{state.message}</AlertDescription></Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="password">设置登录密码</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" />
        {state.errors?.password?.[0] ? <p className="text-sm text-destructive">{state.errors.password[0]}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">确认密码</Label>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" />
        {state.errors?.confirmPassword?.[0] ? <p className="text-sm text-destructive">{state.errors.confirmPassword[0]}</p> : null}
      </div>
      <Button className="h-11 w-full text-base" disabled={pending} type="submit">
        {pending ? <LoaderCircle className="animate-spin" /> : <KeyRound />}
        {pending ? "正在激活…" : "设置密码并登录"}
      </Button>
    </form>
  )
}
