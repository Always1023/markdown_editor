// I-017 导出客户端：保存对话框 + 导出落盘两条通道的渲染端封装。
// 组件经这里触达系统能力，不直接调 window.api（AGENTS 代码规范第 3 条）。
export interface ExportDialogArgs {
  title: string
  defaultFileName: string
  filters: Array<{ name: string; extensions: string[] }>
}

export async function chooseExportPath(
  args: ExportDialogArgs
): Promise<{ filePath: string | null; canceled: boolean }> {
  const choose = window.api?.app?.chooseExportPath
  if (!choose) {
    throw new Error('[export] 保存对话框通道不可用（缺 preload 桥）')
  }
  return choose(args)
}

export async function exportDocument(args: {
  kind: 'html' | 'pdf'
  filePath: string
  html: string
}): Promise<{ written: boolean; bytes: number }> {
  const run = window.api?.app?.exportDocument
  if (!run) {
    throw new Error('[export] 导出落盘通道不可用（缺 preload 桥）')
  }
  return run(args)
}
