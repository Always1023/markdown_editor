// I-017 导出 HTML：用 marked 把当前文档渲染成独立可打开的完整 HTML 文档
// （内联最小样式，不依赖编辑器运行时）。gfm 表格默认开启。
import { marked } from 'marked'

const EXPORT_CSS = [
  'body { margin: 0; background: #f6f6f4; color: #1f2328; font-family: "Segoe UI", "Microsoft YaHei", sans-serif; }',
  '.markdown-body { max-width: 820px; margin: 0 auto; padding: 32px 24px; background: #fff; line-height: 1.7; }',
  '.markdown-body h1, .markdown-body h2, .markdown-body h3 { line-height: 1.3; }',
  '.markdown-body table { border-collapse: collapse; width: 100%; margin: 12px 0; }',
  '.markdown-body th, .markdown-body td { border: 1px solid #d0d7de; padding: 6px 12px; text-align: left; }',
  '.markdown-body th { background: #f6f8fa; }',
  '.markdown-body pre { background: #f6f8fa; padding: 12px; border-radius: 6px; overflow: auto; }',
  '.markdown-body code { background: #f6f8fa; padding: 1px 4px; border-radius: 3px; }',
  '.markdown-body blockquote { margin: 12px 0; padding: 0 12px; border-left: 3px solid #d0d7de; color: #59636e; }'
].join('\n')

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function buildStandaloneHtml(markdown: string, title: string): string {
  const body = marked.parse(markdown, { async: false }) as string
  return [
    '<!doctype html>',
    '<html lang="zh-Hans-CN">',
    '<head>',
    '<meta charset="utf-8">',
    `<title>${escapeHtml(title)}</title>`,
    `<style>${EXPORT_CSS}</style>`,
    '</head>',
    '<body>',
    `<article class="markdown-body">${body}</article>`,
    '</body>',
    '</html>',
    ''
  ].join('\n')
}
