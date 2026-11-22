// I-021 白屏长观察探针：带 CDP 启动安装版，监听控制台/异常，每 5s 采样 DOM 状态，抓白屏转变瞬间。
const { spawn } = require('node:child_process')
const { join } = require('node:path')
const { writeFileSync } = require('node:fs')

const EXE = join('D:', 'Coding', 'markdown_editor', 'dist', 'win-unpacked', 'markdown_editor.exe')
const PORT = '9232'
const SHOT_DIR = 'C:/Users/Always/AppData/Local/Temp/me-acceptance'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const app = spawn(EXE, [`--remote-debugging-port=${PORT}`], { detached: true, stdio: 'ignore', cwd: join('D:', 'Coding', 'markdown_editor', 'dist', 'win-unpacked') }).unref()
  console.log('launched, watching 4 minutes...')

  let page = null
  for (let i = 0; i < 30 && !page; i++) {
    try {
      const ts = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()
      page = ts.find((t) => t.type === 'page')
      if (!page) await sleep(1000)
    } catch { await sleep(1000) }
  }
  if (!page) throw new Error('no page')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  let id = 0
  const pending = new Map()
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return }
    if (m.method === 'Runtime.consoleAPICalled')
      console.log(`[console.${m.params.type}]`, (m.params.args ?? []).map(a => (a.value ?? a.description ?? '')).join(' ').slice(0, 300))
    else if (m.method === 'Runtime.exceptionThrown')
      console.log('[EXCEPTION]', (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text ?? '').slice(0, 500))
    else if (m.method === 'Log.entryAdded')
      console.log(`[log.${m.params.entry.level}]`, String(m.params.entry.text).slice(0, 200))
  }
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); return r.result?.result?.value }
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable')

  let prevWhite = null
  for (let t = 0; t < 48; t++) {
    await sleep(5000)
    const state = {
      editable: await ev("!!document.querySelector('[contenteditable=\"true\"]')").catch(() => 'DEAD'),
      bodyLen: await ev("document.body ? document.body.innerHTML.length : -1").catch(() => 'DEAD'),
      textLen: await ev("document.body ? (document.body.innerText || '').length : -1").catch(() => 'DEAD')
    }
    const white = state.editable !== true || state.textLen < 50
    const marker = (white !== prevWhite) ? ' <-- TRANSITION' : ''
    console.log(`t+${t * 5}s editable=${state.editable} bodyLen=${state.bodyLen} textLen=${state.textLen}${marker}`)
    if (white && prevWhite === false) {
      console.log('WHITE TRANSITION CAUGHT, visible text head:', await ev("document.body.innerText.slice(0, 200)"))
      const shot = await send('Page.captureScreenshot', { format: 'png' })
      writeFileSync(join(SHOT_DIR, 'white-transition.png'), Buffer.from(shot.result.data, 'base64'))
    }
    prevWhite = white
  }
  ws.close()
  console.log('timeline done')
  process.exit(0)
}

main().catch((e) => { console.error('WATCH FAILED:', e.message); process.exit(1) })
