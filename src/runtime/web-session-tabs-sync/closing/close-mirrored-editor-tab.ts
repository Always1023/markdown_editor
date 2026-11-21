// 本地单机形态的镜像关闭桩。Orca 原实现（同名文件）在多主机 / 移动会话下把
// 编辑器关闭镜像到其他客户端；本产品不做多主机（PRD「不做」），关闭只发生在本地。
// 保留同一导出形状，调用方（close-file-action / editor-tab-retirement /
// recently-closed-editor-tabs）不需要改动。
type MirroredEditorCloseState = object

export function notifyHostOfMirroredEditorClose(
  state: MirroredEditorCloseState,
  worktreeId: string | null | undefined,
  fileId: string,
  tabId?: string
): boolean {
  void state
  void worktreeId
  void fileId
  void tabId
  // 本地形态没有可镜像的远端；返回 false 表示没有镜像视图被关闭。
  return false
}
