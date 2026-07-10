import ExcelJS from "exceljs"

import { getCurrentUser } from "@/lib/session"

export const runtime = "nodejs"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return Response.json({ message: "请先登录。" }, { status: 401 })
  if (user.role !== "ROOT") return Response.json({ message: "没有下载权限。" }, { status: 403 })

  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet("用户导入模板")
  worksheet.columns = [
    { header: "姓名", key: "displayName", width: 18 },
    { header: "用户名", key: "username", width: 22 },
    { header: "角色", key: "role", width: 14 },
    { header: "初始密码", key: "password", width: 22 },
    { header: "首次登录改密", key: "mustChangePassword", width: 18 },
  ]
  worksheet.addRow({
    displayName: "示例学生",
    username: "student_001",
    role: "普通用户",
    password: "Example@123",
    mustChangePassword: "是",
  })
  worksheet.getRow(1).font = { bold: true }
  worksheet.getColumn("role").eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) cell.dataValidation = { type: "list", allowBlank: false, formulae: ['"普通用户,管理员"'] }
  })
  worksheet.getColumn("mustChangePassword").eachCell({ includeEmpty: true }, (cell, rowNumber) => {
    if (rowNumber > 1) cell.dataValidation = { type: "list", allowBlank: false, formulae: ['"是,否"'] }
  })
  worksheet.views = [{ state: "frozen", ySplit: 1 }]

  const buffer = await workbook.xlsx.writeBuffer()
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="user-import-template.xlsx"',
      "Cache-Control": "no-store",
    },
  })
}
