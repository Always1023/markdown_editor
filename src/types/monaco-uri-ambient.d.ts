// monaco esm 深路径无类型产物；tsconfig paths 把该指定符映射到这里（打包走真实 JS，不影响 vite）。
// 类形状取自 Orca src/renderer/src/env.d.ts 的同名声明。
export class URI {
  static file(path: string): URI
  static parse(value: string): URI
  static from(components: { scheme: string; authority?: string; path?: string }): URI
  readonly scheme: string
  readonly authority: string
  readonly path: string
  readonly fragment: string
  readonly fsPath: string
  with(change: { path?: string; fragment?: string }): URI
  toString(skipEncoding?: boolean): string
}
