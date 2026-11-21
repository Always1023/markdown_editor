/// <reference types="vite/client" />

// Monaco 贡献缺公开类型；只声明迁移件引用到的模块面（自 Orca env.d.ts 摘取）。
declare module 'monaco-editor/esm/vs/base/common/uri.js' {
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
    toString(skipEncoding?: string): string
  }
}

declare module 'monaco-editor/esm/vs/base/common/async.js' {
  export class Delayer<T = unknown> {
    constructor(defaultDelay: number)
    trigger(task: () => T | Promise<T>, delay?: number): Promise<T | undefined>
    cancel(): void
    dispose(): void
  }
}

declare module 'monaco-editor/esm/vs/base/common/lifecycle.js' {
  type Disposable = {
    dispose(): void
  }
  export class DisposableStore {
    add<T extends Disposable>(disposable: T): T
    clear(): void
    dispose(): void
  }
}

declare module 'monaco-editor/esm/vs/base/common/platform.js' {
  export const isMacintosh: boolean
  export const isWindows: boolean
  export const isLinux: boolean
  export const isWeb: boolean
}

interface ImportMetaEnv {
  readonly VITE_EXPOSE_STORE?: boolean
}

export {}

// moduleResolution bundler 下，非相对导入的 ambient 匹配会剥掉 .js 后缀；
// 双名声明保证两种查找都能命中。
declare module 'monaco-editor/esm/vs/base/common/uri' {
  export { URI } from 'monaco-editor/esm/vs/base/common/uri.js'
}
