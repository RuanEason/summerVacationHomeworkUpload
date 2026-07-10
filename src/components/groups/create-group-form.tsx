"use client"

import { useActionState } from "react"
import { CheckCircle2, LoaderCircle, Users } from "lucide-react"

import { createGroup, type GroupActionState } from "@/app/actions/groups"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const initialState: GroupActionState = {}

export function CreateGroupForm({ admins }: { admins: Array<{ id: string; displayName: string; username: string }> }) {
  const [state, action, pending] = useActionState(createGroup, initialState)

  return (
    <form action={action} className="space-y-5">
      {state.message ? (
        <Alert variant={state.success ? "default" : "destructive"}>
          {state.success ? <CheckCircle2 /> : null}
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="name">小组名称</Label>
        <Input id="name" name="name" placeholder="例如：高一 1 班暑假打卡组" />
        {state.errors?.name?.[0] ? <p className="text-sm text-destructive">{state.errors.name[0]}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="ownerAdminId">小组管理员</Label>
        <select
          id="ownerAdminId"
          name="ownerAdminId"
          defaultValue=""
          className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="" disabled>请选择已经激活的 ADMIN</option>
          {admins.map((admin) => <option key={admin.id} value={admin.id}>{admin.displayName}（{admin.username}）</option>)}
        </select>
        {state.errors?.ownerAdminId?.[0] ? <p className="text-sm text-destructive">{state.errors.ownerAdminId[0]}</p> : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">小组说明</Label>
        <Textarea id="description" name="description" placeholder="可选，例如班级、年级或作业范围" />
      </div>
      <label className="flex items-start gap-3 rounded-xl border bg-muted/30 p-3 text-sm">
        <input name="ownerParticipates" type="checkbox" className="mt-0.5 size-4 accent-primary" />
        <span>
          <span className="block font-medium">管理员本人也需要打卡</span>
          <span className="text-muted-foreground">勾选后，该 ADMIN 会同时成为本组打卡成员。</span>
        </span>
      </label>
      <Button disabled={pending || admins.length === 0} type="submit">
        {pending ? <LoaderCircle className="animate-spin" /> : <Users />}
        {pending ? "正在创建…" : "创建小组"}
      </Button>
      {admins.length === 0 ? <p className="text-sm text-muted-foreground">请先创建并激活至少一个 ADMIN 用户。</p> : null}
    </form>
  )
}
