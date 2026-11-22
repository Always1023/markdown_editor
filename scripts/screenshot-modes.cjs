// 验收证据探针（可丢弃）：经 CDP 连打包版应用，截三渲染模式（rich / source / preview）。
// 用 node 22+ 内建 WebSocket 直连 DevTools 协议，不引第三方包。
const { writeFileSync } = require('node:fs')
const { join } = require('node:path')

const PORT = process.argv[2] ?? '9222'
const OUT_DIR = process.argv[3] ?? '.'
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
  const page = targets.find((t) => t.type === 'page')
  if (!page) throw new Error('no page target')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
  let msgId = 0
  const pending = new Map()
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data)
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg)
      pending.delete(msg.id)
    }
  }
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = ++msgId
      pending.set(id, resolve)
      ws.send(JSON.stringify({ id, method, params }))
    })
  await send('Runtime.enable')
  const evaluate = async (expression) => {
    const reply = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (reply.result.exceptionDetails) {
      throw new Error('eval failed: ' + JSON.stringify(reply.result.exceptionDetails))
    }
    return reply.result.result?.value
  }
  const waitFor = async (expr, timeoutMs = 30000) => {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      if (await evaluate(expr)) return true
      await sleep(500)
    }
    throw new Error('timeout waiting: ' + expr)
  }
  const shot = async (name) => {
    const reply = await send('Page.captureScreenshot', { format: 'png' })
    const path = join(OUT_DIR, name)
    writeFileSync(path, Buffer.from(reply.result.data, 'base64'))
    console.log('saved', path)
  }
  const click = (testId) => evaluate(`document.querySelector('[data-testid="${testId}"]').click()`)

  await waitFor("!!document.querySelector('[contenteditable=\"true\"]')", 60000)
  await sleep(1500)
  await shot('mode-rich.png')

  await click('mode-source')
  await waitFor("!!document.querySelector('.monaco-editor')", 60000)
  await sleep(2500)
  await shot('mode-source.png')

  await click('mode-preview')
  await waitFor("!!document.querySelector('[data-testid=\"preview-host\"] .markdown-body')", 60000)
  await sleep(1500)
  await shot('mode-preview.png')

  ws.close()
  console.log('done')
  process.exit(0)
}

main().catch((error) => {
  console.error('FAILED:', error.message)
  process.exit(1)
})
