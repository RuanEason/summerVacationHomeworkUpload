import { Readable } from "node:stream"
import { hash } from "bcryptjs"
import ExcelJS from "exceljs"
import { revalidatePath } from "next/cache"

import { getCurrentUser } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const runtime = "nodejs"

type ImportUser = {
  rowNumber: number
  displayName: string
  username: string
  role: "ADMIN" | "USER"
  password: string
  mustChangePassword: boolean
}

function normalizedHeader(value: string) {
  return value.trim().toLowerCase().replaceAll(" ", "")
}

export async function POST(request: Request) {
  const root = await getCurrentUser()
  if (!root) return Response.json({ message: "请先登录。" }, { status: 401 })
  if (root.role !== "ROOT") return Response.json({ message: "只有 ROOT 可以批量导入用户。" }, { status: 403 })

  const formData = await request.formData()
  const file = formData.get("file")
  if (!(file instanceof File)) return Response.json({ message: "请选择 Excel 或 CSV 文件。" }, { status: 400 })
  if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
    return Response.json({ message: "导入文件不能超过 5MB。" }, { status: 400 })
  }

  const extension = file.name.split(".").pop()?.toLowerCase()
  if (extension !== "xlsx" && extension !== "csv") {
    return Response.json({ message: "仅支持 .xlsx 和 .csv 文件。" }, { status: 400 })
  }

  const workbook = new ExcelJS.Workbook()
  const bytes = new Uint8Array(await file.arrayBuffer())
  try {
    if (extension === "csv") {
      await workbook.csv.read(Readable.from([bytes]))
    } else {
      await workbook.xlsx.read(Readable.from([bytes]))
    }
  } catch {
    return Response.json({ message: "文件无法解析，请重新下载模板填写。" }, { status: 400 })
  }

  const worksheet = workbook.worksheets[0]
  if (!worksheet || worksheet.rowCount < 2) {
    return Response.json({ message: "表格中没有可导入的用户。" }, { status: 400 })
  }

  const headerMap = new Map<string, number>()
  worksheet.getRow(1).eachCell((cell, columnNumber) => {
    headerMap.set(normalizedHeader(cell.text), columnNumber)
  })
  const columns = {
    displayName: headerMap.get("姓名") ?? headerMap.get("displayname"),
    username: headerMap.get("用户名") ?? headerMap.get("username"),
    role: headerMap.get("角色") ?? headerMap.get("role"),
    password: headerMap.get("初始密码") ?? headerMap.get("password"),
    mustChangePassword: headerMap.get("首次登录改密") ?? headerMap.get("mustchangepassword"),
  }
  if (!columns.displayName || !columns.username || !columns.role || !columns.password) {
    return Response.json({ message: "缺少姓名、用户名、角色或初始密码列。" }, { status: 400 })
  }

  const imported: ImportUser[] = []
  const errors: string[] = []
  const seenUsernames = new Set<string>()

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1 || imported.length + errors.length >= 100) return
    const displayName = row.getCell(columns.displayName!).text.trim()
    const username = row.getCell(columns.username!).text.trim()
    const roleText = row.getCell(columns.role!).text.trim().toLowerCase()
    const password = row.getCell(columns.password!).text
    const changePasswordText = columns.mustChangePassword ? row.getCell(columns.mustChangePassword).text.trim().toLowerCase() : "是"

    if (!displayName && !username && !password) return
    if (displayName.length < 2 || displayName.length > 80) errors.push(`第 ${rowNumber} 行：姓名长度应为 2–80 个字符`)
    else if (!/^[a-zA-Z0-9_.-]{3,64}$/.test(username)) errors.push(`第 ${rowNumber} 行：用户名格式不正确`)
    else if (seenUsernames.has(username)) errors.push(`第 ${rowNumber} 行：用户名 ${username} 在表格中重复`)
    else if (password.length < 8 || password.length > 72) errors.push(`第 ${rowNumber} 行：密码长度应为 8–72 个字符`)
    else if (!["admin", "管理员", "user", "普通用户"].includes(roleText)) errors.push(`第 ${rowNumber} 行：角色只能填写普通用户或管理员`)
    else {
      seenUsernames.add(username)
      imported.push({
        rowNumber,
        displayName,
        username,
        role: roleText === "admin" || roleText === "管理员" ? "ADMIN" : "USER",
        password,
        mustChangePassword: !["否", "false", "0", "no"].includes(changePasswordText),
      })
    }
  })

  if (worksheet.rowCount > 101) errors.push("单次最多导入 100 个用户，请拆分文件。")
  const existingUsers = imported.length ? await prisma.user.findMany({
    where: { username: { in: imported.map((user) => user.username) } },
    select: { username: true },
  }) : []
  const existingNames = new Set(existingUsers.map((user) => user.username))
  imported.forEach((user) => {
    if (existingNames.has(user.username)) errors.push(`第 ${user.rowNumber} 行：用户名 ${user.username} 已存在`)
  })

  if (errors.length) {
    return Response.json({ message: "导入前检查未通过，请修正表格。", errors: errors.slice(0, 30) }, { status: 400 })
  }
  if (!imported.length) return Response.json({ message: "没有找到可导入的用户。" }, { status: 400 })

  const prepared = await Promise.all(imported.map(async (user) => ({
    ...user,
    passwordHash: await hash(user.password, 12),
  })))

  await prisma.$transaction(async (tx) => {
    for (const user of prepared) {
      const created = await tx.user.create({
        data: {
          displayName: user.displayName,
          username: user.username,
          role: user.role,
          status: "ACTIVE",
          passwordHash: user.passwordHash,
          mustChangePassword: user.mustChangePassword,
          createdById: root.id,
        },
      })
      await tx.auditLog.create({
        data: {
          actorId: root.id,
          action: "USER_IMPORTED",
          entityType: "User",
          entityId: created.id,
          summary: `通过表格导入${user.role === "ADMIN" ? "管理员" : "普通用户"} ${user.username}`,
        },
      })
    }
  })

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/users")
  return Response.json({
    success: true,
    created: prepared.length,
    admins: prepared.filter((user) => user.role === "ADMIN").length,
    users: prepared.filter((user) => user.role === "USER").length,
  })
}
