import { CheckInExperience } from "@/components/check-in/check-in-experience"
import { requireRole } from "@/lib/auth"
import { getAvailableCheckInTasks } from "@/lib/check-in"
import { getCheckInAvailableAt } from "@/lib/check-in-window"
import { dateKeyToDatabaseDate, getShanghaiDateKey } from "@/lib/dates"
import { prisma } from "@/lib/prisma"

type CalendarStatus = "submitted" | "makeup" | "expired" | "returned" | "pending" | "scheduled"

const calendarStatusPriority: Record<CalendarStatus, number> = {
  submitted: 1,
  scheduled: 2,
  pending: 3,
  makeup: 4,
  expired: 5,
  returned: 6,
}

function getMonthBounds(dateKey: string) {
  const [year, month] = dateKey.split("-").map(Number)
  const firstDay = `${year}-${String(month).padStart(2, "0")}-01`
  const nextMonth = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, "0")}-01`

  return {
    start: dateKeyToDatabaseDate(firstDay),
    end: dateKeyToDatabaseDate(nextMonth),
  }
}

function getCalendarMonth(value: string | undefined, fallbackDateKey: string) {
  if (value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return value
  return fallbackDateKey.slice(0, 7)
}

export default async function CheckInPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[] }>
}) {
  const user = await requireRole(["ADMIN", "USER"])
  const today = getShanghaiDateKey()
  const params = await searchParams
  const calendarMonth = getCalendarMonth(typeof params.month === "string" ? params.month : undefined, today)
  const monthBounds = getMonthBounds(`${calendarMonth}-01`)

  const [tasks, membership, calendarOccurrences] = await Promise.all([
    getAvailableCheckInTasks(user.id),
    prisma.groupMember.findUnique({ where: { userId: user.id }, include: { group: true } }),
    prisma.checkInOccurrence.findMany({
      where: {
        checkInDate: { gte: monthBounds.start, lt: monthBounds.end },
        OR: [
          {
            plan: {
              status: "ACTIVE",
              group: { members: { some: { userId: user.id, participatesInCheckIn: true } } },
            },
          },
          { submissions: { some: { userId: user.id, status: { in: ["SUBMITTED", "MAKEUP"] } } } },
        ],
      },
      include: {
        plan: { select: { allowEarlyCheckIn: true, earlyCheckInDays: true } },
        submissions: {
          where: { userId: user.id },
          select: { status: true, returnedAt: true },
        },
      },
    }),
  ])

  const now = new Date()
  const calendarEntries = new Map<string, CalendarStatus>()
  for (const occurrence of calendarOccurrences) {
    const submission = occurrence.submissions[0]
    const dateKey = occurrence.checkInDate.toISOString().slice(0, 10)
    let status: CalendarStatus

    if (submission?.status === "SUBMITTED") status = "submitted"
    else if (submission?.status === "MAKEUP") status = "makeup"
    else if (submission?.returnedAt) status = "returned"
    else if (now > occurrence.dueAt) status = occurrence.makeupUntil && now <= occurrence.makeupUntil ? "makeup" : "expired"
    else if (now >= getCheckInAvailableAt(occurrence.opensAt, occurrence.plan)) status = "pending"
    else status = "scheduled"

    const current = calendarEntries.get(dateKey)
    if (!current || calendarStatusPriority[status] > calendarStatusPriority[current]) {
      calendarEntries.set(dateKey, status)
    }
  }

  return (
    <CheckInExperience
      calendarEntries={Array.from(calendarEntries, ([dateKey, status]) => ({ dateKey, status }))}
      calendarMonth={calendarMonth}
      groupName={membership?.group.name ?? null}
      tasks={tasks}
      today={today}
      userName={user.displayName}
    />
  )
}
