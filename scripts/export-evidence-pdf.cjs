// I-017 验收证据探针（可丢弃）：与 electron/main/export.ts defaultPrintToPdf 同一 API
// 序列（隐藏 BrowserWindow + loadFile + printToPDF），产出真实 PDF 成品样张。
const { app, BrowserWindow } = require('electron')
const { writeFileSync } = require('node:fs')

const [htmlPath, pdfPath] = process.argv.slice(2)

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true }
  })
  try {
    await win.loadFile(htmlPath)
    const buf = await win.webContents.printToPDF({ printBackground: true })
    writeFileSync(pdfPath, buf)
    console.log('PDF written:', pdfPath, buf.length, 'bytes, header:', buf.subarray(0, 5).toString())
  } finally {
    win.destroy()
  }
  app.exit(0)
})
