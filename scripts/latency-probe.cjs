// I-006 A5 机检覆盖补充（可丢弃探针）：真实按键路径（Input.dispatchKeyEvent
// keyDown/keyUp）连续输入 20 字符，测「按键 → 编辑器 DOM 反映」延迟分布。
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function main() {
  const PORT = process.argv[2] ?? '9223'
  let targets = null
  for (let i = 0; i < 30; i++) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()
      if (targets.some((t) => t.type === 'page')) break
    } catch {}
    await sleep(1000)
  }
  const page = targets.find((t) => t.type === 'page')
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
    if (reply.result.exceptionDetails) throw new Error(JSON.stringify(reply.result.exceptionDetails))
    return reply.result.result?.value
  }
  const len = () => evaluate(
    `(document.querySelector('[contenteditable="true"]')?.textContent ?? '').length`
  )

  await evaluate(`(() => {
    const el = document.querySelector('[contenteditable="true"]')
    el.focus()
    const sel = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    sel.removeAllRanges()
    sel.addRange(range)
    return true
  })()`)
  await sleep(200)

  const N = 20
  const startLen = await len()
  const latencies = []
  for (let i = 0; i < N; i++) {
    const target = startLen + i + 1
    const t0 = Date.now()
    await send('Input.dispatchKeyEvent', {
      type: 'keyDown', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, text: 'a', unmodifiedText: 'a'
    })
    await send('Input.dispatchKeyEvent', {
      type: 'keyUp', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65
    })
    const deadline = t0 + 5000
    let reflected = false
    while (Date.now() < deadline) {
      if ((await len()) >= target) { reflected = true; break }
      await sleep(8)
    }
    if (!reflected) throw new Error('keystroke ' + (i + 1) + ' not reflected in 5s')
    latencies.push(Date.now() - t0)
    await sleep(30)
  }
  latencies.sort((a, b) => a - b)
  const avg = latencies.reduce((s, v) => s + v, 0) / N
  const p50 = latencies[Math.floor(N * 0.5)]
  const p95 = latencies[Math.min(N - 1, Math.floor(N * 0.95))]
  const max = latencies[N - 1]
  const finalLen = await len()
  console.log('typed chars:', N, 'editor len:', startLen, '->', finalLen)
  console.log('latency ms  avg=%.0f p50=%d p95=%d max=%d  all=%s', avg, p50, p95, max, latencies.join(','))
  console.log('A5 基线：p95 <= 100ms 即无可感知卡顿（人只判体验）')
  ws.close()
  process.exit(0)
}

main().catch((error) => {
  console.error('FAILED:', error.message)
  process.exit(1)
})
