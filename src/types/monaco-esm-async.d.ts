// Monaco 0.55.1 的 esm 深路径只有实现没有 .d.ts；bundler 解析下 ambient declare 不生效，
// 需要 tsconfig paths 把该 specifier 映到本文件（与 monaco-uri-ambient 同一模式）。
// 形状自 Orca src/renderer/src/env.d.ts 摘取。
export class Delayer<T = unknown> {
  constructor(defaultDelay: number)
  trigger(task: () => T | Promise<T>, delay?: number): Promise<T | undefined>
  cancel(): void
  dispose(): void
}
