import { z } from "zod"

import { addDaysToDateKey, dateKeyToDatabaseDate, formatShanghaiDate, getShanghaiDateKey } from "@/lib/dates"
import { getCheckInAvailableAt, isEarlyCheckIn } from "@/lib/check-in-window"
import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/prisma"

const allowedDays = [7, 30, 90]

function csvCell(value: string | number | null | undefined) {
  let text = value == null ? "" : String(value)
  if (/^[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}

function getStatus({
  planStatus,
  opensAt,
  dueAt,
  makeupUntil,
  submissionStatus,
  submittedAt,
  earlyCheckInSettings,
  now,
}: {
  planStatus: string
  opensAt: Date
  dueAt: Date
  makeupUntil: Date | null
  submissionStatus?: string
  submittedAt?: Date | null
  earlyCheckInSettings: { allowEarlyCheckIn: boolean; earlyCheckInDays: number }
  now: Date
}) {
  if (submissionStatus === "SUBMITTED") return isEarlyCheckIn(submittedAt, opensAt) ? "提前打卡" : "已提交"
  if (submissionStatus === "MAKEUP") return "已补卡"
  if (planStatus === "PAUSED") return "规则暂停"
  if (now < getCheckInAvailableAt(opensAt, earlyCheckInSettings)) return "未开始"
  if (now <= dueAt) return "待提交"
  if (makeupUntil && now <= makeupUntil) return "可补卡"
  return "缺卡"
}

export async function GET(request: Request) {
  const viewer = await getCurrentUser()
  if (!viewer) return Response.json({ message: "请先登录。" }, { status: 401 })
  if (viewer.role !== "ROOT" && viewer.role !== "ADMIN") {
    return Response.json({ message: "没有导出权限。" }, { status: 403 })
  }

  const url = new URL(request.url)
  const requestedDays = Number(url.searchParams.get("days"))
  const days = allowedDays.includes(requestedDays) ? requestedDays : 30
  const groupIdValue = url.searchParams.get("groupId")
  const groupId = groupIdValue ? z.string().uuid().safeParse(groupIdValue) : null
  if (groupId && !groupId.success) return Response.json({ message: "小组参数无效。" }, { status: 400 })

  const since = dateKeyToDatabaseDate(addDaysToDateKey(getShanghaiDateKey(), -(days - 1)))
  const groupWhere = {
    ...(viewer.role === "ADMIN" ? { ownerAdminId: viewer.id } : {}),
    ...(groupId?.success ? { id: groupId.data } : {}),
  }
  const occurrences = await prisma.checkInOccurrence.findMany({
    where: {
      checkInDate: { gte: since },
      plan: { group: groupWhere },
    },
    orderBy: [{ checkInDate: "desc" }, { createdAt: "desc" }],
    include: {
      plan: {
        include: {
          group: {
            include: {
              members: {
                where: { participatesInCheckIn: true },
                include: { user: true },
              },
            },
          },
        },
      },
      submissions: {
        where: { status: { in: ["SUBMITTED", "MAKEUP"] } },
        include: { _count: { select: { images: true } } },
      },
    },
  })

  const now = new Date()
  const rows: Array<Array<string | number | null | undefined>> = [[
    "小组",
    "打卡规则",
    "打卡日期",
    "姓名",
    "用户名",
    "状态",
    "提交时间",
    "图片数量",
    "备注",
  ]]

  for (const occurrence of occurrences) {
    const submissionsByUser = new Map(occurrence.submissions.map((submission) => [submission.userId, submission]))
    for (const member of occurrence.plan.group.members) {
      const submission = submissionsByUser.get(member.userId)
      rows.push([
        occurrence.plan.group.name,
        occurrence.plan.title,
        formatShanghaiDate(occurrence.checkInDate, { year: "numeric", month: "2-digit", day: "2-digit" }),
        member.user.displayName,
        member.user.username,
        getStatus({
          planStatus: occurrence.plan.status,
          opensAt: occurrence.opensAt,
          dueAt: occurrence.dueAt,
          makeupUntil: occurrence.makeupUntil,
          submissionStatus: submission?.status,
          submittedAt: submission?.submittedAt,
          earlyCheckInSettings: occurrence.plan,
          now,
        }),
        submission?.submittedAt ? formatShanghaiDate(submission.submittedAt, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : "",
        submission?._count.images ?? 0,
        submission?.note ?? "",
      ])
    }
  }

  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`
  const filename = `check-in-report-${getShanghaiDateKey()}-${days}d.csv`

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
