"use client"

import { useRef, useState } from "react"
import { CheckCircle2, Download, FileSpreadsheet, LoaderCircle, Upload } from "lucide-react"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type ImportResult = {
  message?: string
  errors?: string[]
  success?: boolean
  created?: number
  admins?: number
  users?: number
}

export function BulkImportCard() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File>()
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<ImportResult>()

  async function upload() {
    if (!file) return
    setPending(true)
    setResult(undefined)
    const formData = new FormData()
    formData.append("file", file)

    try {
      const response = await fetch("/api/users/import", { method: "POST", body: formData })
      const body = await response.json()
      setResult(body)
      if (response.ok) {
        setFile(undefined)
        if (inputRef.current) inputRef.current.value = ""
      }
    } catch {
      setResult({ message: "上传失败，请检查网络后重试。" })
    } finally {
      setPending(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div><CardTitle>Excel 批量导入</CardTitle><CardDescription className="mt-1">支持 .xlsx 和 .csv，单次最多导入 100 个用户。</CardDescription></div>
          <Button variant="outline" size="sm" asChild><a href="/api/users/import-template"><Download />下载模板</a></Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {result ? <Alert variant={result.success ? "default" : "destructive"}>{result.success ? <CheckCircle2 /> : null}<AlertDescription>{result.success ? `成功创建 ${result.created} 个账号，其中管理员 ${result.admins} 个、普通用户 ${result.users} 个。` : result.message}{result.errors?.length ? <ul className="mt-2 list-disc space-y-1 pl-5">{result.errors.map((error) => <li key={error}>{error}</li>)}</ul> : null}</AlertDescription></Alert> : null}
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3 rounded-lg border border-dashed px-4 text-sm text-muted-foreground hover:border-primary hover:text-primary">
            <FileSpreadsheet className="size-5" />
            <span className="truncate">{file?.name ?? "选择 Excel 或 CSV 文件"}</span>
            <input ref={inputRef} type="file" accept=".xlsx,.csv" className="sr-only" onChange={(event) => setFile(event.target.files?.[0])} />
          </label>
          <Button type="button" className="h-11" disabled={!file || pending} onClick={upload}>{pending ? <LoaderCircle className="animate-spin" /> : <Upload />}{pending ? "正在检查并导入…" : "开始导入"}</Button>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">导入前会完整检查用户名、角色和密码；存在错误时不会写入任何用户。</p>
      </CardContent>
    </Card>
  )
}
