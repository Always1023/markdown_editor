// I-021 A2 探针（自包含）：启动打包版（CDP）→ 确认挂载 → 杀渲染子进程 → 轮询验证自动 reload 恢复 → 收尾。
const { spawn, execSync } = require('node:child_process')
const { homedir } = require('node:os')
const { join } = require('node:path')

const EXE = process.argv[2] ?? join(homedir(), 'AppData', 'Local', 'Programs', 'markdown_editor', 'markdown_editor.exe')
const PORT = '9225'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function connect() {
  for (let i = 0; i < 30; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()
      const page = targets.find((t) => t.type === 'page')
      if (page) {
        const ws = new WebSocket(page.webSocketDebuggerUrl)
        await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
        let msgId = 0
        const pending = new Map()
        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data)
          if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
        }
        return {
          evaluate(expression) {
            const id = ++msgId
            ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }))
            return new Promise((resolve) => pending.set(id, resolve)).then((r) => r.result?.result?.value)
          },
          close: () => ws.close()
        }
      }
    } catch {}
    await sleep(1000)
  }
  throw new Error('no CDP target')
}

async function main() {
  execSync(`powershell -Command "Get-Process | Where-Object {$_.Name -like '*markdown*'} | Stop-Process -Force -ErrorAction SilentlyContinue"`, { stdio: 'ignore' })
  await sleep(1000)
  const app = spawn(EXE, [`--remote-debugging-port=${PORT}`], { detached: true, stdio: 'ignore' }).unref()

  const session = await connect()
  let before = false
  for (let i = 0; i < 30 && !before; i++) {
    await sleep(1000)
    try {
      before = (await session.evaluate("!!document.querySelector('[contenteditable=\"true\"]')")) === true
    } catch { /* 页面重建间隙 */ }
  }
  console.log('before-kill contenteditable:', before)
  if (before !== true) throw new Error('renderer not mounted before kill')
  session.close()

  // 杀掉主窗口进程的渲染子进程（--type=renderer）
  const psFind = `powershell -Command "$m = Get-Process markdown_editor | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1; $kids = Get-CimInstance Win32_Process -Filter \\"ParentProcessId = $($m.Id)\\" | Where-Object { $_.CommandLine -match '--type=renderer' }; if ($kids) { $k = @($kids)[0]; Stop-Process -Id $k.ProcessId -Force; Write-Output $k.ProcessId }"`
  const killed = execSync(psFind, { encoding: 'utf8' }).trim()
  console.log('killed renderer pid:', killed)
  if (!/^\d+$/.test(killed)) throw new Error('no renderer child killed')

  // 轮询验证：自动 reload 后编辑器重新挂载
  let mounted = false
  const after = await connect()
  for (let i = 0; i < 25 && !mounted; i++) {
    await sleep(1000)
    try {
      mounted = (await after.evaluate("!!document.querySelector('[contenteditable=\"true\"]')")) === true
    } catch { /* reload 间隙连接失败则重连 */ }
  }
  await after.close()
  console.log('after-kill contenteditable:', mounted)
  execSync(`powershell -Command "Get-Process | Where-Object {$_.Name -like '*markdown*'} | Stop-Process -Force -ErrorAction SilentlyContinue"`, { stdio: 'ignore' })
  console.log(mounted ? 'RECOVERY PASS' : 'RECOVERY FAIL')
  process.exit(mounted ? 0 : 1)
}

main().catch((error) => { console.error('PROBE FAILED:', error.message); process.exit(1) })
