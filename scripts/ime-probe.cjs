// I-006 A4 机检覆盖补充（可丢弃探针）：经 CDP Input.imeSetComposition 驱动渲染器
// 的 IME 组合事件管线（compositionstart → compositionupdate → compositionend + 提交），
// 断言组合文本不丢键、不重复，且经 300ms 防抖自动保存落到磁盘。
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

const PORT = process.argv[2] ?? '9222'
const DISK_FILE = process.argv[3]
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
  const editorText = () =>
    evaluate(`(document.querySelector('[contenteditable="true"]')?.textContent ?? '')`)

  // 焦点 + 光标移到文档末尾（ProseMirror 受控选区走 Range API）。
  await evaluate(`(() => {
    const el = document.querySelector('[contenteditable="true"]')
    el.focus()
    const sel = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    sel.removeAllRanges()
    sel.addRange(range)
    return el.textContent.length
  })()`)
  const before = await editorText()
  console.log('editor chars before:', before.length)

  // 1) 组合开始：'中文'（compositionstart/update）
  await send('Input.imeSetComposition', { text: '中文', selectionStart: 2, selectionEnd: 2 })
  await sleep(150)
  const composing1 = await editorText()
  // 2) 组合更新：'中文输入'（模拟继续输入拼音候选）
  await send('Input.imeSetComposition', { text: '中文输入', selectionStart: 4, selectionEnd: 4 })
  await sleep(150)
  const composing2 = await editorText()
  // 3) 提交：最终文本（compositionend + insert）
  await send('Input.insertText', { text: '中文输入法测试' })
  await sleep(200)
  const after = await editorText()

  const checks = {
    compositionFirstShown: composing1.includes('中文'),
    compositionUpdated: composing2.includes('中文输入'),
    noDuplicateDuringUpdate: !composing2.includes('中文输入中文输入'),
    committed: after.includes('中文输入法测试'),
    noStaleCompositionLeft: !after.includes('中文输入') || after.includes('中文输入法测试')
  }
  console.log('checks:', JSON.stringify(checks, null, 1))

  // 4) 防抖自动保存（300ms）后磁盘应包含提交文本。
  await sleep(1500)
  let diskHas = null
  try {
    const disk = readFileSync(DISK_FILE, 'utf-8')
    diskHas = disk.includes('中文输入法测试')
  } catch (error) {
    diskHas = 'unreadable: ' + error.message
  }
  console.log('disk autosave contains committed text:', diskHas)

  const pass =
    checks.compositionFirstShown && checks.compositionUpdated && checks.noDuplicateDuringUpdate &&
    checks.committed && diskHas === true
  console.log(pass ? 'IME-PROBE PASS' : 'IME-PROBE FAIL')
  process.exit(pass ? 0 : 1)
}

main().catch((error) => {
  console.error('FAILED:', error.message)
  process.exit(1)
})
