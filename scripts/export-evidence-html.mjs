// I-017 验收证据探针（可丢弃）：用真正的 buildStandaloneHtml 生成导出 HTML 成品样张。
import { buildStandaloneHtml } from '../src/app/export-html.ts'
import { writeFileSync } from 'node:fs'

const DOC = `# 丝滑 Markdown 编辑器

把 Orca（MIT）验证过的编辑子系统抽成独立产品：**怎么编辑都不重排你手写的格式**。

## 列表

- 输入时格式不被重排
- 粘贴图片自动落盘
- 表格、代码块、任务列表

## 表格

| 特性 | 状态 |
| ---- | ---- |
| 富文本编辑 | 已迁移 |
| Markdown 往返 | 保真 |
| 外壳 | 已交付 |

## 代码

\`\`\`ts
const greeting = 'hello, markdown'
\`\`\`

> 引用一段话，试试*斜体*、\`行内代码\`与[链接](https://example.com)。
`

const out = process.argv[2]
writeFileSync(out, buildStandaloneHtml(DOC, '导出样张'), 'utf-8')
console.log('HTML written:', out)
