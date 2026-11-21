// SSH 切片桩。Orca 原实现（174 行）管理 SSH 连接生命周期；本产品不做 SSH 主机。
// 只导出消费方（worktree-operation-generation）引用的代次读取函数。
export { getLocalSshTargetConnectionGeneration } from './runtime-environment-ssh'
