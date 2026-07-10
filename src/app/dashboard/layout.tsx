import { LogOut } from "lucide-react"
import { redirect } from "next/navigation"

import { logout } from "@/app/actions/auth"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { requireUser } from "@/lib/auth"
import { getSystemConfig } from "@/lib/system"

const roleNames = { ROOT: "ROOT", ADMIN: "管理员", USER: "普通用户" } as const

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, config] = await Promise.all([requireUser(), getSystemConfig()])

  if (user.mustChangePassword) redirect("/change-password")

  return (
    <SidebarProvider className="h-svh min-h-0 overflow-hidden">
      <AppSidebar role={user.role} systemName={config?.systemName ?? "作业打卡"} />
      <SidebarInset className="min-h-0 touch-pan-y overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur sm:px-6">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-5" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.displayName}</p>
            <p className="text-xs text-muted-foreground">{roleNames[user.role]}</p>
          </div>
          <form action={logout}>
            <Button variant="ghost" size="sm" type="submit">
              <LogOut />
              <span className="hidden sm:inline">退出登录</span>
            </Button>
          </form>
        </header>
        <div className="flex min-h-max flex-1 flex-col p-4 sm:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
