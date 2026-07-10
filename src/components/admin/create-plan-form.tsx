"use client"

import { useActionState } from "react"
import { CalendarDays, CheckCircle2, LoaderCircle } from "lucide-react"

import { createCheckInPlan, type AdminActionState } from "@/app/actions/admin"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const initialState: AdminActionState = {}
const weekdayOptions = [
  { value: 1, label: "一" },
  { value: 2, label: "二" },
  { value: 3, label: "三" },
  { value: 4, label: "四" },
  { value: 5, label: "五" },
  { value: 6, label: "六" },
  { value: 0, label: "日" },
]

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null
  return <p className="text-sm text-destructive">{messages[0]}</p>
}

export function CreatePlanForm({ groups }: { groups: Array<{ id: string; name: string }> }) {
  const [state, action, pending] = useActionState(createCheckInPlan, initialState)

  return (
    <form action={action} className="space-y-5">
      {state.message ? (
        <Alert variant={state.success ? "default" : "destructive"}>
          {state.success ? <CheckCircle2 /> : null}
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="groupId">适用小组</Label>
          <select id="groupId" name="groupId" defaultValue={groups.length === 1 ? groups[0].id : ""} className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
            {groups.length > 1 ? <option value="" disabled>请选择小组</option> : null}
            {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select>
          <FieldError messages={state.errors?.groupId} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="title">规则名称</Label>
          <Input id="title" name="title" placeholder="例如：暑假数学作业" />
          <FieldError messages={state.errors?.title} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">打卡说明</Label>
        <Textarea id="description" name="description" placeholder="告诉同学需要上传什么内容，可选" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="startDate">开始日期</Label>
          <Input id="startDate" name="startDate" type="date" />
          <FieldError messages={state.errors?.startDate} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endDate">结束日期</Label>
          <Input id="endDate" name="endDate" type="date" />
          <FieldError messages={state.errors?.endDate} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>每周打卡日</Label>
        <div className="grid grid-cols-7 gap-2">
          {weekdayOptions.map((day) => (
            <label key={day.value} className="flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border p-2 text-xs transition-colors has-checked:border-primary has-checked:bg-primary/5 has-checked:text-primary">
              <input type="checkbox" name="weekdays" value={day.value} defaultChecked={day.value >= 1 && day.value <= 5} className="size-4 accent-primary" />
              周{day.label}
            </label>
          ))}
        </div>
        <FieldError messages={state.errors?.weekdays} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="openTime">每日开放时间</Label>
          <Input id="openTime" name="openTime" type="time" defaultValue="00:00" />
          <FieldError messages={state.errors?.openTime} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dueTime">每日截止时间</Label>
          <Input id="dueTime" name="dueTime" type="time" defaultValue="23:00" />
          <FieldError messages={state.errors?.dueTime} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="requiredImageCount">必须上传图片数</Label>
          <Input id="requiredImageCount" name="requiredImageCount" type="number" min="1" max="20" defaultValue="1" />
          <FieldError messages={state.errors?.requiredImageCount} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="maxImageCount">最多上传图片数</Label>
          <Input id="maxImageCount" name="maxImageCount" type="number" min="1" max="30" defaultValue="9" />
          <FieldError messages={state.errors?.maxImageCount} />
        </div>
      </div>

      <div className="grid gap-4 rounded-xl border bg-muted/30 p-4 sm:grid-cols-[1fr_10rem] sm:items-end">
        <label className="flex items-start gap-3 text-sm">
          <input name="allowMakeup" type="checkbox" defaultChecked className="mt-0.5 size-4 accent-primary" />
          <span><span className="block font-medium">允许补打卡</span><span className="text-muted-foreground">超过正常截止时间后，在指定天数内仍可提交。</span></span>
        </label>
        <div className="space-y-2">
          <Label htmlFor="makeupDays">可补天数</Label>
          <Input id="makeupDays" name="makeupDays" type="number" min="0" max="30" defaultValue="3" />
          <FieldError messages={state.errors?.makeupDays} />
        </div>
      </div>

      <Button disabled={pending || groups.length === 0} type="submit">
        {pending ? <LoaderCircle className="animate-spin" /> : <CalendarDays />}
        {pending ? "正在生成每日任务…" : "创建并启用规则"}
      </Button>
    </form>
  )
}
