// Monaco 粘贴贡献缺公开类型；只声明迁移件引用到的 override 面（自 Orca env.d.ts 摘取）。
type PasteImplementation = () => boolean | Promise<unknown>

export const PasteAction:
  | {
      addImplementation: (
        priority: number,
        name: string,
        implementation: PasteImplementation
      ) => { dispose: () => void }
    }
  | undefined

export const InMemoryClipboardMetadataManager: {
  INSTANCE: {
    get: (pastedText: string) => {
      isFromEmptySelection?: boolean
      multicursorText?: string[] | null
      mode?: string | null
    } | null
  }
}
