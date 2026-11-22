import { app, shell, BrowserWindow } from 'electron'
import { appendFileSync } from 'node:fs'
import { join } from 'node:path'
import { registerLocalIpcHandlers } from './ipc'
import { closeAllWatchers } from './fs-watch'

// I-021 白屏加固：打包版首启白屏（人真机报告，不稳定复现）指向首启时序或 GPU 合成失败。
// 文本编辑器的绘制不依赖 GPU 加速——软渲染的打字延迟实测见 issue 自验 A4，稳定性优先。
app.disableHardwareAcceleration()

// 主进程生命周期日志（失败可见可行动）：.userData/main.log，追加写，失败不影响主流程。
function appendLog(line: string): void {
  try {
    appendFileSync(join(app.getPath('userData'), 'main.log'), `[${new Date().toISOString()}] ${line}\n`)
  } catch {
    /* 日志写不进去时放弃记录 */
  }
}

const MAX_MAINFRAME_RETRIES = 3
const MAX_RENDERER_RELOADS = 3

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false
    }
  })

  let mainframeRetries = 0
  let rendererReloads = 0

  const load = (): void => {
    if (process.env['ELECTRON_RENDERER_URL']) {
      void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
      void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }
  }

  mainWindow.on('ready-to-show', () => {
    appendLog('window ready-to-show')
    mainWindow.show()
  })

  // 首启时序竞争（如杀软首扫拖慢资源读取）会导致主框架加载失败 → 延迟重试，不让白屏成为终态。
  mainWindow.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    if (!isMainFrame) return
    appendLog(`main frame load failed: ${code} ${description} ${url}`)
    if (mainframeRetries < MAX_MAINFRAME_RETRIES) {
      mainframeRetries++
      setTimeout(load, 1000)
    }
  })

  // 渲染进程崩溃（含 GPU 相关异常）→ 自动 reload，不让用户停在白屏；有界防止崩溃循环。
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    appendLog(`renderer gone: reason=${details.reason} exitCode=${details.exitCode}`)
    if (details.reason !== 'clean-exit' && rendererReloads < MAX_RENDERER_RELOADS) {
      rendererReloads++
      mainWindow.webContents.reload()
    }
  })

  mainWindow.webContents.on('did-finish-load', () => {
    appendLog('main frame loaded')
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  load()
}

app.whenReady().then(() => {
  appendLog(`app ready v${app.getVersion()} (${process.platform})`)
  registerLocalIpcHandlers()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // 全部窗口销毁后释放 watcher 句柄；不关会挂住进程与目录删除（A4 资源回收）。
  void closeAllWatchers().finally(() => {
    if (process.platform !== 'darwin') app.quit()
  })
})
