import "server-only"

import { PrismaMariaDb } from "@prisma/adapter-mariadb"

import { PrismaClient } from "@/generated/prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error("缺少 DATABASE_URL 环境变量")
  }

  return new PrismaClient({
    adapter: new PrismaMariaDb(connectionString),
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
