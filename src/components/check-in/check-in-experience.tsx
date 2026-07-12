"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { CarFront, ChevronLeft, ChevronRight, CheckCircle2, ClipboardCheck, History, X } from "lucide-react"

import { CheckInTaskCard } from "@/components/check-in/check-in-task-card"
import { Button } from "@/components/ui/button"
import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet"

type TaskImage = { id: string; url: string; originalName: string }
type CheckInTask = {
  id: string
  title: string
  description: string | null
  groupName: string
  checkInDate: string
  availableAt: string
  opensAt: string
  dueAt: string
  makeupUntil: string | null
  requiredImageCount: number
  maxImageCount: number
  currentTime: string
  submission: {
    id: string
    status: string
    submittedAt: string | null
    note: string | null
    reviewNote: string | null
    returnedAt: string | null
    images: TaskImage[]
  } | null
}

type CalendarStatus = "submitted" | "makeup" | "expired" | "returned" | "pending" | "scheduled"
type CalendarEntry = { dateKey: string; status: CalendarStatus }

const weekdays = ["日", "一", "二", "三", "四", "五", "六"]

function dateParts(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number)
  return { year, month, day }
}

function formatHeaderDate(dateKey: string) {
  const { month, day } = dateParts(dateKey)
  return `${String(month).padStart(2, "0")}月${String(day).padStart(2, "0")}日`
}

function getCalendarDays(year: number, monthIndex: number) {
  const firstWeekday = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  const daysInPreviousMonth = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate()
  const usedCells = firstWeekday + daysInMonth
  const totalCells = usedCells > 35 ? 42 : 35

  return Array.from({ length: totalCells }, (_, index) => {
    const day = index - firstWeekday + 1
    if (day < 1) return { day: daysInPreviousMonth + day, otherMonth: true, monthOffset: -1 }
    if (day > daysInMonth) return { day: day - daysInMonth, otherMonth: true, monthOffset: 1 }
    return { day, otherMonth: false, monthOffset: 0 }
  })
}

function statusClass(status?: CalendarStatus) {
  if (status === "submitted") return "bg-[#35c996] text-white shadow-[0_5px_12px_rgba(53,201,150,0.35)]"
  if (status === "makeup") return "bg-[#f7bc36] text-white shadow-[0_5px_12px_rgba(247,188,54,0.35)]"
  if (status === "expired") return "bg-[#fb6f72] text-white shadow-[0_5px_12px_rgba(251,111,114,0.3)]"
  if (status === "returned") return "bg-[#9b6df3] text-white shadow-[0_5px_12px_rgba(155,109,243,0.3)]"
  if (status === "pending") return "bg-[#3685ff] text-white shadow-[0_5px_12px_rgba(54,133,255,0.32)]"
  if (status === "scheduled") return "border border-[#bfd9ff] bg-[#eff6ff] text-[#2d7cf5]"
  return "text-slate-700"
}

export function CheckInExperience({
  calendarEntries,
  calendarMonth,
  groupName,
  tasks,
  today,
  userName,
}: {
  calendarEntries: CalendarEntry[]
  calendarMonth: string
  groupName: string | null
  tasks: CheckInTask[]
  today: string
  userName: string
}) {
  const router = useRouter()
  const displayedMonth = dateParts(`${calendarMonth}-01`)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  const entryByDate = useMemo(() => new Map(calendarEntries.map((entry) => [entry.dateKey, entry.status])), [calendarEntries])
  const calendarDays = useMemo(() => getCalendarDays(displayedMonth.year, displayedMonth.month - 1), [displayedMonth.month, displayedMonth.year])
  const selectedTask = tasks.find((task) => task.id === selectedTaskId)
  const unfinishedTasks = tasks.filter((task) => !task.submission || !["SUBMITTED", "MAKEUP"].includes(task.submission.status))
  const primaryTask = unfinishedTasks[0] ?? tasks[0]
  const weekday = weekdays[new Date(`${today}T12:00:00+08:00`).getUTCDay()]
  const statusText = !groupName
    ? "你还没有加入打卡小组"
    : unfinishedTasks.length
      ? `今天有 ${unfinishedTasks.length} 项任务可以完成`
      : tasks.length
        ? "今天的打卡任务已完成"
        : "今天暂时没有待完成任务"

  function changeMonth(amount: number) {
    const date = new Date(Date.UTC(displayedMonth.year, displayedMonth.month - 1 + amount, 1))
    const month = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
    router.push(`/dashboard/check-in?month=${month}`)
  }

  function openCheckIn() {
    if (!primaryTask) return
    setSelectedTaskId(tasks.length === 1 ? primaryTask.id : null)
    setIsSheetOpen(true)
  }

  return (
    <div className="-m-4 min-h-[calc(100svh-3.5rem)] overflow-hidden bg-[linear-gradient(160deg,#2878f9_0%,#4a9fff_54%,#8ccaff_100%)] text-white sm:-m-6">
      <div className="relative mx-auto flex min-h-[calc(100svh-3.5rem)] w-full max-w-md flex-col px-4 pb-28 pt-8 sm:px-5 sm:pt-10">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-44 opacity-30 [background-image:linear-gradient(90deg,rgba(39,110,217,.65)_1px,transparent_1px),linear-gradient(0deg,rgba(39,110,217,.45)_1px,transparent_1px)] [background-size:32px_32px] [mask-image:linear-gradient(to_top,black,transparent)]" />
        <div aria-hidden className="pointer-events-none absolute bottom-0 left-0 right-0 h-24 bg-[linear-gradient(135deg,transparent_0_10%,rgba(24,104,218,.34)_10%_19%,transparent_19%_30%,rgba(24,104,218,.25)_30%_46%,transparent_46%_57%,rgba(24,104,218,.38)_57%_67%,transparent_67%)]" />

        <header className="relative z-10 px-2">
          <div className="mb-8 flex items-center justify-between gap-4">
            <div className="min-w-0"><p className="text-sm font-medium text-white/75">每日工作打卡</p><h1 className="mt-1 truncate text-xl font-semibold tracking-wide">你好，{userName}</h1></div>
            <Link href="/dashboard/history" className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-white/95 transition hover:bg-white/25"><History className="size-3.5" />打卡记录</Link>
          </div>
          <div className="flex items-end justify-between gap-4">
            <div><p className="text-3xl font-bold tracking-tight">{formatHeaderDate(today)}<span className="ml-2 text-sm font-normal text-white/85">/ 星期{weekday}</span></p><p className="mt-1.5 text-sm text-white/85">{statusText}</p></div>
            {groupName ? <span className="mb-0.5 max-w-28 truncate rounded-full bg-white/15 px-2.5 py-1 text-xs text-white/90">{groupName}</span> : null}
          </div>
        </header>

        <main className="relative z-10 mt-7 flex flex-1 flex-col">
          <section className="relative overflow-hidden rounded-[1.65rem] bg-white p-5 text-slate-800 shadow-[0_18px_42px_rgba(27,88,184,0.22)]">
            <div aria-hidden className="pointer-events-none absolute inset-0 opacity-45 [background-image:linear-gradient(rgba(220,231,246,.55)_1px,transparent_1px),linear-gradient(90deg,rgba(220,231,246,.55)_1px,transparent_1px)] [background-size:42px_42px]" />
            <div className="relative">
              <div className="mb-6 flex items-center justify-between text-[#2d7cf5]">
                <button type="button" onClick={() => changeMonth(-1)} aria-label="上一个月" className="flex size-8 items-center justify-center rounded-full bg-[#eef5ff] transition hover:bg-[#dfedff]"><ChevronLeft className="size-4" /></button>
                <h2 className="text-lg font-bold">{displayedMonth.year} 年 {displayedMonth.month} 月</h2>
                <button type="button" onClick={() => changeMonth(1)} aria-label="下一个月" className="flex size-8 items-center justify-center rounded-full bg-[#eef5ff] transition hover:bg-[#dfedff]"><ChevronRight className="size-4" /></button>
              </div>

              <div className="grid grid-cols-7 gap-y-3 text-center">
                {weekdays.map((day) => <span key={day} className="text-xs font-medium text-slate-400">{day}</span>)}
                {calendarDays.map(({ day, otherMonth, monthOffset }, index) => {
                  const dateKey = otherMonth ? "" : `${displayedMonth.year}-${String(displayedMonth.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                  const isToday = dateKey === today
                  const status = dateKey ? entryByDate.get(dateKey) : undefined
                  return <div key={`${monthOffset}-${day}-${index}`} className="flex h-9 items-center justify-center"><span className={`relative flex size-8 items-center justify-center rounded-full text-sm font-medium ${otherMonth ? "text-slate-300" : statusClass(status)} ${isToday && !status ? "font-bold text-[#2d7cf5]" : ""}`}>{day}{isToday && !status ? <i className="absolute bottom-0.5 h-0.5 w-3 rounded-full bg-[#2d7cf5]" /> : null}</span></div>
                })}
              </div>

              <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-medium text-slate-500"><span className="inline-flex items-center gap-1"><i className="size-2.5 rounded-full bg-[#35c996]" />已完成</span><span className="inline-flex items-center gap-1"><i className="size-2.5 rounded-full bg-[#f7bc36]" />补卡</span><span className="inline-flex items-center gap-1"><i className="size-2.5 rounded-full bg-[#fb6f72]" />已过期</span><span className="inline-flex items-center gap-1"><i className="size-2.5 rounded-full bg-[#9b6df3]" />待重提</span><span className="inline-flex items-center gap-1"><i className="size-2.5 rounded-full bg-[#3685ff]" />待打卡</span></div>
                <Button type="button" size="sm" variant="outline" onClick={openCheckIn} disabled={!primaryTask} className="h-8 rounded-full border-[#2d7cf5] px-4 font-bold text-[#2d7cf5] hover:bg-[#eef5ff] hover:text-[#2d7cf5]">去打卡</Button>
              </div>
            </div>
          </section>

          <div className="mt-4 px-2 text-xs leading-5 text-white/80"><p>提示：按任务要求上传现场照片后即可提交打卡。</p><p>提前打卡、补卡和退回重提仍按原有规则执行。</p></div>
        </main>

        <div aria-hidden className="pointer-events-none absolute bottom-4 right-1 z-0 flex items-end gap-2 text-white/90"><div className="mb-1 h-10 w-12 rounded-t-xl bg-white/30" /><div className="h-16 w-8 rounded-t-lg bg-white/25" /><CarFront className="size-24 drop-shadow-[0_8px_10px_rgba(15,83,180,.25)]" strokeWidth={1.5} /></div>
      </div>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="bottom" showCloseButton={false} className="mx-auto max-h-[90svh] max-w-xl gap-0 overflow-y-auto rounded-t-[1.75rem] border-0 bg-white p-0 text-slate-900 sm:bottom-6 sm:rounded-[1.75rem]">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white/95 px-5 py-4 backdrop-blur">
            <div><SheetTitle className="text-lg font-bold">{selectedTask ? "完成打卡" : "选择打卡任务"}</SheetTitle><p className="mt-0.5 text-xs text-slate-500">上传任务所需照片后确认提交</p></div>
            <SheetClose asChild><Button variant="ghost" size="icon-sm" aria-label="关闭"><X className="size-5" /></Button></SheetClose>
          </div>
          <div className="p-4 pb-7">
            {selectedTask ? <div key={selectedTask.id} className="animate-in fade-in-0 slide-in-from-bottom-4 duration-200"><button type="button" onClick={() => setSelectedTaskId(null)} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-[#2d7cf5]"><ChevronLeft className="size-4" />返回任务列表</button><CheckInTaskCard task={selectedTask} /></div> : (
              <div className="space-y-3">
                {tasks.map((task) => {
                  const isDone = Boolean(task.submission && ["SUBMITTED", "MAKEUP"].includes(task.submission.status))
                  return <button key={task.id} type="button" onClick={() => setSelectedTaskId(task.id)} className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left transition hover:border-[#b9d6ff] hover:bg-[#f4f8ff]"><span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${isDone ? "bg-[#e8faf3] text-[#28ad80]" : "bg-[#eaf3ff] text-[#2d7cf5]"}`}>{isDone ? <CheckCircle2 className="size-5" /> : <ClipboardCheck className="size-5" />}</span><span className="min-w-0 flex-1"><span className="block truncate font-semibold">{task.title}</span><span className="mt-1 block truncate text-xs text-slate-500">{task.groupName}</span></span><span className={`text-xs font-medium ${isDone ? "text-[#28ad80]" : "text-[#2d7cf5]"}`}>{isDone ? "已完成" : "去打卡"}</span></button>
                })}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
