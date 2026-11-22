// 一次性诊断探针（可丢弃）：连打包版应用 CDP，抓渲染端控制台 / 异常 / DOM 状态 + 截图。
const { writeFileSync } = require('node:fs')
const { join } = require('node:path')

const PORT = process.argv[2] ?? '9223'
const OUT = process.argv[3] ?? '.'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function main() {
  let targets = null
  for (let i = 0; i < 30; i++) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()
      if (targets.some((t) => t.type === 'page')) break
    } catch {}
    await sleep(1000)
  }
  if (!targets) throw new Error('no CDP target')
  const page = targets.find((t) => t.type === 'page')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
  let msgId = 0
  const pending = new Map()
  const events = []
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data)
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return }
    if (msg.method) {
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = (msg.params.args ?? []).map((a) => a.value ?? a.description ?? '').join(' ')
        events.push(`[console.${msg.params.type}] ${text}`.slice(0, 500))
      } else if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails
        events.push(`[EXCEPTION] ${d.text} ${d.exception?.description ?? ''} @${d.url ?? ''}:${d.lineNumber ?? ''}`.slice(0, 800))
      } else if (msg.method === 'Log.entryAdded') {
        events.push(`[log.${msg.params.entry.level}] ${msg.params.entry.text} (${msg.params.entry.source})`.slice(0, 500))
      }
    }
  }
  const send = (method, params = {}) =>
    new Promise((resolve) => { const id = ++msgId; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })) })
  const evaluate = async (expression) => {
    const reply = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (reply.result.exceptionDetails) return 'EVAL-FAIL: ' + JSON.stringify(reply.result.exceptionDetails).slice(0, 400)
    return reply.result.result?.value
  }
  await send('Runtime.enable')
  await send('Log.enable')
  await send('Page.enable')
  await sleep(8000) // 给渲染充足时间（打包版首启大 bundle）
  const state = {
    readyState: await evaluate('document.readyState'),
    url: await evaluate('location.href'),
    bodyChildren: await evaluate('document.body ? document.body.children.length : -1'),
    bodyHtmlLen: await evaluate('document.body ? document.body.innerHTML.length : -1'),
    rootChildren: await evaluate("document.getElementById('root') ? document.getElementById('root').children.length : 'no-root-el'"),
    contenteditable: await evaluate("!!document.querySelector('[contenteditable=\"true\"]')")
  }
  console.log('DOM STATE:', JSON.stringify(state, null, 2))
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(OUT, 'diag-white.png'), Buffer.from(shot.result.data, 'base64'))
  console.log('--- captured events (' + events.length + ') ---')
  for (const e of events.slice(0, 40)) console.log(e)
  ws.close()
  process.exit(0)
}

main().catch((error) => { console.error('DIAG FAILED:', error.message); process.exit(1) })
