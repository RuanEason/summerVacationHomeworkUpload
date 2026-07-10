import "server-only"

import { cache } from "react"
import { cookies, headers } from "next/headers"

import { prisma } from "@/lib/prisma"
import { createOpaqueToken, hashOpaqueToken } from "@/lib/tokens"

const SESSION_COOKIE = "check_in_session"
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14

export async function createSession(userId: string) {
  const token = createOpaqueToken()
  const requestHeaders = await headers()
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000)

  await prisma.session.create({
    data: {
      tokenHash: hashOpaqueToken(token),
      userId,
      expiresAt,
      ipAddress: requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent: requestHeaders.get("user-agent")?.slice(0, 255),
    },
  })

  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  })
}

export async function deleteCurrentSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value

  if (token) {
    await prisma.session.deleteMany({
      where: { tokenHash: hashOpaqueToken(token) },
    })
  }

  cookieStore.delete(SESSION_COOKIE)
}

export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value

  if (!token) return null

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashOpaqueToken(token) },
    include: { user: true },
  })

  if (!session || session.expiresAt <= new Date()) {
    return null
  }

  if (session.user.status !== "ACTIVE") {
    return null
  }

  return session.user
})
