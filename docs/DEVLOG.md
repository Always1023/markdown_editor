# DEVLOG

## 2026-11-22 · B1 批次完成（I-001～I-005 合并，I-006 待验收）
- B1 六条按链序提交：I-001 脚手架 → I-002 shared/assets → I-004 store/i18n → I-005 preload 桥 → I-003 编辑器内核 → I-006 demo。前五条模型验收通过并合并 main；I-006 在分支 I-006-smooth-demo 待人验收（残差 3 条：A4 中文输入法 / A5 手感 / A6 观感）。
- 三件套全绿：typecheck 0 错、build exit 0、test 358 用例 0 失败（86/88 文件，2 skipped 为 layout-owner main 分支）。
- 本轮关键修复：runtime-rpc-call 恢复 Orca local 路由（blob 图片管线）、compat setActiveWorktree 激活语义、hydrateTabsSession 本地子集、diff-comments 切片并入、宿主通道「无通道即跳过」守卫。
- 待决新增一条：摘除边界重审（review 呈现层 / diff-comment 死代码），默认随阶段 4 清理；详见 I-003 / I-004 验收结果表。
- dev 冒烟通过（Electron 三段 + 模块链转译）；无远程仓库，全部提交仅在本地下。
