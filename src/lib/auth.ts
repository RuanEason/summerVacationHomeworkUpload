import "server-only"

import { redirect } from "next/navigation"

import type { UserRole } from "@/generated/prisma/enums"
import { getCurrentUser } from "@/lib/session"

export async function requireUser() {
  const user = await getCurrentUser()

  if (!user) redirect("/login")

  return user
}

export async function requireRole(roles: UserRole[]) {
  const user = await requireUser()

  if (!roles.includes(user.role)) redirect("/dashboard")

  return user
}
