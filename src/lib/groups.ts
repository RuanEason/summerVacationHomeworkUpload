import "server-only"

import { requireRole } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function requireOwnedGroup(groupId: string) {
  const user = await requireRole(["ROOT", "ADMIN"])
  const group = await prisma.group.findUnique({ where: { id: groupId } })

  if (!group || (user.role === "ADMIN" && group.ownerAdminId !== user.id)) {
    throw new Error("FORBIDDEN_GROUP")
  }

  return { user, group }
}

export async function getAdminGroups(userId: string) {
  return prisma.group.findMany({
    where: { ownerAdminId: userId, isActive: true },
    orderBy: { createdAt: "asc" },
  })
}
