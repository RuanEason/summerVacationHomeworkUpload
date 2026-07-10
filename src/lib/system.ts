import "server-only"

import { cache } from "react"
import { connection } from "next/server"

import { prisma } from "@/lib/prisma"

export const getSystemConfig = cache(async () => {
  await connection()

  return prisma.systemConfig.findUnique({
    where: { id: 1 },
    include: { rootUser: true },
  })
})

export async function isSystemInitialized() {
  const config = await getSystemConfig()
  return Boolean(config?.rootUser && config.rootUser.role === "ROOT")
}
