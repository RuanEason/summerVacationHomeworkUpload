"use client"

import { useActionState, useState } from "react"
import { CheckCircle2, LoaderCircle } from "lucide-react"

import { updateEarlyCheckInSettings, type AdminActionState } from "@/app/actions/admin"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const initialState: AdminActionState = {}

export function EarlyCheckInSettingsForm({
  planId,
  allowEarlyCheckIn,
  earlyCheckInDays,
}: {
  planId: string
  allowEarlyCheckIn: boolean
  earlyCheckInDays: number
}) {
  const [enabled, setEnabled] = useState(allowEarlyCheckIn)
  const updateAction = updateEarlyCheckInSettings.bind(null, planId)
  const [state, action, pending] = useActionState(updateAction, initialState)

  return (
    <form action={action} className="space-y-3 rounded-xl border bg-muted/20 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <label className="flex items-start gap-3 text-sm">
          <input name="allowEarlyCheckIn" type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="mt-0.5 size-4 accent-primary" />
          <span><span className="block font-medium">允许提前打卡</span><span className="text-muted-foreground">从原定开放时刻前的指定天数开始提交。</span></span>
        </label>
        <div className="flex items-end gap-2">
          <div className="space-y-2">
            <Label htmlFor={`earlyCheckInDays-${planId}`}>提前天数</Label>
            <Input id={`earlyCheckInDays-${planId}`} name="earlyCheckInDays" type="number" min="1" max="365" defaultValue={allowEarlyCheckIn ? earlyCheckInDays : 1} readOnly={!enabled} aria-disabled={!enabled} className={`w-28 ${enabled ? "" : "opacity-50"}`} />
          </div>
          <Button type="submit" size="sm" disabled={pending}>{pending ? <LoaderCircle className="animate-spin" /> : null}保存</Button>
        </div>
      </div>
      {state.errors?.earlyCheckInDays?.[0] ? <p className="text-sm text-destructive">{state.errors.earlyCheckInDays[0]}</p> : null}
      {state.message ? <Alert variant={state.success ? "default" : "destructive"}>{state.success ? <CheckCircle2 /> : null}<AlertDescription>{state.message}</AlertDescription></Alert> : null}
    </form>
  )
}
