import { redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/session"
import { isSystemInitialized } from "@/lib/system"

export default async function Home() {
  if (!(await isSystemInitialized())) redirect("/setup")

  redirect((await getCurrentUser()) ? "/dashboard" : "/login")
}
