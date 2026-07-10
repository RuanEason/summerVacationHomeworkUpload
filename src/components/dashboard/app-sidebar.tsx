"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart3, ClipboardCheck, FileClock, LayoutDashboard, Settings2, ShieldCheck, UserCog, Users } from "lucide-react"

import type { UserRole } from "@/generated/prisma/enums"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const rootItems = [
  { title: "总览", href: "/dashboard", icon: LayoutDashboard },
  { title: "用户管理", href: "/dashboard/users", icon: UserCog },
  { title: "管理员与小组", href: "/dashboard/groups", icon: Users },
  { title: "打卡规则", href: "/dashboard/rules", icon: Settings2 },
  { title: "提交记录", href: "/dashboard/submissions", icon: ClipboardCheck },
  { title: "全局统计", href: "/dashboard/statistics", icon: BarChart3 },
  { title: "操作日志", href: "/dashboard/audit-logs", icon: FileClock },
]

const adminItems = [
  { title: "小组总览", href: "/dashboard", icon: LayoutDashboard },
  { title: "我的打卡", href: "/dashboard/check-in", icon: ClipboardCheck },
  { title: "我的打卡记录", href: "/dashboard/history", icon: FileClock },
  { title: "我的组员", href: "/dashboard/members", icon: Users },
  { title: "打卡规则", href: "/dashboard/rules", icon: Settings2 },
  { title: "提交记录", href: "/dashboard/submissions", icon: ClipboardCheck },
]

const userItems = [
  { title: "今日打卡", href: "/dashboard/check-in", icon: ClipboardCheck },
  { title: "打卡记录", href: "/dashboard/history", icon: FileClock },
]

export function AppSidebar({ role, systemName }: { role: UserRole; systemName: string }) {
  const pathname = usePathname()
  const items = role === "ROOT" ? rootItems : role === "ADMIN" ? adminItems : userItems

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <ShieldCheck className="size-4" />
                </span>
                <span className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{systemName}</span>
                  <span className="truncate text-xs">作业打卡管理</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{role === "ROOT" ? "ROOT 管理" : role === "ADMIN" ? "小组管理" : "我的打卡"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`))} tooltip={item.title}>
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
        <p className="px-2">Asia/Shanghai · 中国标准时间</p>
      </SidebarFooter>
    </Sidebar>
  )
}
