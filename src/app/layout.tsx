import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import { TooltipProvider } from "@/components/ui/tooltip"

import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: {
    default: "暑假作业打卡",
    template: "%s · 暑假作业打卡",
  },
  description: "面向学校小组的暑假作业图片打卡与统计系统",
  applicationName: "暑假作业打卡",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "作业打卡",
    statusBarStyle: "default",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-svh bg-background font-sans text-foreground antialiased">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  )
}
