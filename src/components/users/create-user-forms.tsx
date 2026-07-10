"use client"

import { useActionState, useMemo } from "react"
import { CheckCircle2, Copy, Link2, LoaderCircle, UserPlus } from "lucide-react"

import {
  createDirectUser,
  createInvitedUser,
  type UserActionState,
} from "@/app/actions/users"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const initialState: UserActionState = {}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null
  return <p className="text-sm text-destructive">{messages[0]}</p>
}

function RoleField() {
  return (
    <div className="space-y-2">
      <Label htmlFor="role">用户角色</Label>
      <select
        id="role"
        name="role"
        defaultValue="USER"
        className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <option value="USER">普通用户</option>
        <option value="ADMIN">管理员</option>
      </select>
    </div>
  )
}

function CommonFields({ state }: { state: UserActionState }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="displayName">姓名</Label>
        <Input id="displayName" name="displayName" placeholder="例如：李同学" />
        <FieldError messages={state.errors?.displayName} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="username">用户名</Label>
        <Input id="username" name="username" placeholder="例如：li_ming" autoCapitalize="none" />
        <FieldError messages={state.errors?.username} />
      </div>
    </div>
  )
}

function DirectUserForm() {
  const [state, action, pending] = useActionState(createDirectUser, initialState)

  return (
    <form action={action} className="space-y-5">
      {state.message ? (
        <Alert variant={state.success ? "default" : "destructive"}>
          {state.success ? <CheckCircle2 /> : null}
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      <CommonFields state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <RoleField />
        <div className="space-y-2">
          <Label htmlFor="password">初始密码</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" />
          <FieldError messages={state.errors?.password} />
        </div>
      </div>
      <label className="flex items-start gap-3 rounded-xl border bg-muted/30 p-3 text-sm">
        <input name="mustChangePassword" type="checkbox" defaultChecked className="mt-0.5 size-4 accent-primary" />
        <span>
          <span className="block font-medium">首次登录后要求修改密码</span>
          <span className="text-muted-foreground">适合由 ROOT 临时分配初始密码的账号。</span>
        </span>
      </label>
      <Button disabled={pending} type="submit">
        {pending ? <LoaderCircle className="animate-spin" /> : <UserPlus />}
        {pending ? "正在创建…" : "直接创建用户"}
      </Button>
    </form>
  )
}

function InvitedUserForm() {
  const [state, action, pending] = useActionState(createInvitedUser, initialState)
  const activationUrl = useMemo(() => {
    if (!state.activationPath || typeof window === "undefined") return state.activationPath
    return `${window.location.origin}${state.activationPath}`
  }, [state.activationPath])

  async function copyLink() {
    if (activationUrl) await navigator.clipboard.writeText(activationUrl)
  }

  return (
    <form action={action} className="space-y-5">
      {state.message ? (
        <Alert variant={state.success ? "default" : "destructive"}>
          {state.success ? <Link2 /> : null}
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      <CommonFields state={state} />
      <RoleField />
      {activationUrl ? (
        <div className="space-y-2 rounded-xl border bg-primary/5 p-4">
          <Label htmlFor="activationLink">一次性激活链接</Label>
          <div className="flex gap-2">
            <Input id="activationLink" value={activationUrl} readOnly className="font-mono text-xs" />
            <Button type="button" variant="outline" size="icon" onClick={copyLink} aria-label="复制激活链接">
              <Copy />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">链接有效期 72 小时且只能使用一次，请通过微信发送给对应用户。</p>
        </div>
      ) : null}
      <Button disabled={pending} type="submit">
        {pending ? <LoaderCircle className="animate-spin" /> : <Link2 />}
        {pending ? "正在生成…" : "预创建并生成链接"}
      </Button>
    </form>
  )
}

export function CreateUserForms() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>创建用户</CardTitle>
        <CardDescription>直接分配密码，或生成一次性链接让用户自行设置密码。</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="direct">
          <TabsList className="mb-5 grid w-full grid-cols-2 sm:w-80">
            <TabsTrigger value="direct">直接创建</TabsTrigger>
            <TabsTrigger value="invite">预创建链接</TabsTrigger>
          </TabsList>
          <TabsContent value="direct"><DirectUserForm /></TabsContent>
          <TabsContent value="invite"><InvitedUserForm /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
