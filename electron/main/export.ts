// I-017 导出主进程实现：HTML 直接落盘；PDF 走 webContents.printToPDF 管线
// （隐藏窗口加载临时 HTML → printToPDF → Buffer 落盘）。导出目标由系统保存
// 对话框交用户选定，不受工作根越权检查限制（与 fs:writeFile 的差别在此）。
// 探针会直接 import 本文件：electron 只在 printToPDF 真实管线内动态引入，
// 顶层保持 node-only（与 files.ts 同一约定）。
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export type ExportKind = 'html' | 'pdf'

export interface ExportResult {
  written: boolean
  bytes: number
}

export type PdfPrinter = (html: string) => Promise<Uint8Array>

let pdfPrinterOverride: PdfPrinter | null = null

/** 探针注入 printToPDF 替身；传 null 恢复真实管线。 */
export function setPdfPrinter(printer: PdfPrinter | null): void {
  pdfPrinterOverride = printer
}

async function defaultPrintToPdf(html: string): Promise<Uint8Array> {
  // printToPDF 需要真实渲染结果：把导出 HTML 写进临时文件，用隐藏窗口加载后打印。
  const { BrowserWindow } = await import('electron')
  const dir = await mkdtemp(join(tmpdir(), 'me-export-pdf-'))
  const tempFile = join(dir, 'export.html')
  try {
    await writeFile(tempFile, html, 'utf-8')
    const win = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true }
    })
    try {
      await win.loadFile(tempFile)
      return await win.webContents.printToPDF({ printBackground: true })
    } finally {
      win.destroy()
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

export async function exportDocument(args: {
  kind: ExportKind
  filePath: string
  html: string
}): Promise<ExportResult> {
  const data =
    args.kind === 'html'
      ? Buffer.from(args.html, 'utf-8')
      : Buffer.from(await (pdfPrinterOverride ?? defaultPrintToPdf)(args.html))
  await writeFile(args.filePath, data)
  return { written: true, bytes: data.length }
}
