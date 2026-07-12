import { addDays } from "@/lib/dates"

export const MAX_EARLY_CHECK_IN_DAYS = 365

type EarlyCheckInSettings = {
  allowEarlyCheckIn: boolean
  earlyCheckInDays: number
}

export function getCheckInAvailableAt(opensAt: Date, settings: EarlyCheckInSettings) {
  if (!settings.allowEarlyCheckIn) return opensAt

  const days = Math.min(Math.max(settings.earlyCheckInDays, 0), MAX_EARLY_CHECK_IN_DAYS)
  return days > 0 ? addDays(opensAt, -days) : opensAt
}

export function isEarlyCheckIn(submittedAt: Date | null | undefined, opensAt: Date) {
  return Boolean(submittedAt && submittedAt < opensAt)
}
