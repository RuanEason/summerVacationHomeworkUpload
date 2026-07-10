const SHANGHAI_TIME_ZONE = "Asia/Shanghai"
const DAY_MS = 24 * 60 * 60 * 1000

export function getShanghaiDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SHANGHAI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

export function dateKeyToDatabaseDate(dateKey: string) {
  // Prisma maps MySQL DATE values through JavaScript Date. UTC midnight keeps
  // the calendar date stable instead of shifting it to the previous UTC day.
  return new Date(`${dateKey}T00:00:00.000Z`)
}

export function dateKeyAtMinutes(dateKey: string, minutes: number) {
  const hours = Math.floor(minutes / 60).toString().padStart(2, "0")
  const minute = (minutes % 60).toString().padStart(2, "0")
  return new Date(`${dateKey}T${hours}:${minute}:00+08:00`)
}

export function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

export function minutesToTime(minutes: number) {
  return `${Math.floor(minutes / 60).toString().padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`
}

export function addDaysToDateKey(dateKey: string, amount: number) {
  const [year, month, day] = dateKey.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day + amount)).toISOString().slice(0, 10)
}

export function getDateKeyWeekday(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

export function enumerateDateKeys(startDate: string, endDate: string) {
  const result: string[] = []
  let cursor = startDate

  while (cursor <= endDate && result.length <= 370) {
    result.push(cursor)
    cursor = addDaysToDateKey(cursor, 1)
  }

  return result
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_MS)
}

export function formatShanghaiDate(date: Date, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: SHANGHAI_TIME_ZONE,
    ...options,
  }).format(date)
}
