# Issues

当前批次：B1 = I-001 → I-002 → I-004 → I-005 → I-003 → I-006（依赖顺序；触达相交，逐条做）

## 待决问题
- 摘除边界重审（关联 I-003 / I-004）：迁移按完整闭包策略执行后，review 呈现层（rich-markdown/review/ 3 文件）与 diff-comment 链（store 切片 + 4 处引用）为无入口触发的死代码；冻结验收 A3 / A4 的「摘净」与本策略冲突。默认答案：阶段 4「清理死代码」时一并评估摘除；影响范围与代价见两 issue 的验收结果表。

## 阶段 1 · 编辑器内核可验证（M1）

### [build]
- I-001 · feature · 完成 · 脚手架与依赖锁定（Orca 精确版本 + 3 补丁）· 模型验收 · B1（2026-11-22 模型验收，合并 main）

### [shared]
- I-002 · feature · 完成 · src/shared 24 模块 + lib 工具 + 样式资产迁移 · 模型验收 · B1（2026-11-22 模型验收，合并 main）

### [store]
- I-004 · feature · 完成 · 精简 store + i18n 薄封装（涉及 i18n）· 模型验收 · B1（2026-11-22 模型验收，合并 main）

### [bridge]
- I-005 · feature · 完成 · window.api preload 桥（stub）· 模型验收 · B1（2026-11-22 模型验收，合并 main）

### [editor]
- I-003 · feature · 待决 · 编辑器子系统迁移，摘除 review / citations（依赖 I-002 / I-004 / I-005）· 模型验收 · B1 —— 代码与测试全绿；review 呈现层 / diff-comment 链残留为死代码（摘除边界见 issue A3 / A4），待决：是否随阶段 4 一并清理

### [app]
- I-006 · feature · 待验收 · 丝滑度 demo 页组装与验收 · 人验收（残差 3 条）· B1 —— 分支 I-006-smooth-demo；机检全过（build / test / demo 渲染 / round-trip），残差 A4 中文输入法 / A5 手感 / A6 观感

## 阶段 2 · 文件服务与自动保存（M2）
- 想法（待拆）：FileService IPC（照 Orca files.* 语义）、watch 映射 filesystem-change-event、save/flush 移植（pending-flush / stale-view-edit / discard-epoch）、独立自动保存控制器 + 保存队列（writeIfUnchanged）、外部修改横幅、document-images 图片管线与粘贴落盘

## 阶段 3 · 产品外壳（M3）
- 想法（待拆）：文件树（打开文件夹）、多标签、状态栏（保存态 / 模式 / 缩放）、三渲染模式（source = Monaco 动态加载、preview = markdown-preview 移植）、TOC 面板、双链 useMarkdownDocuments 适配本地 fs、设置面板、全局搜索替换、导出 HTML / PDF、i18n 收尾

## 阶段 4 · 测试收尾与发布（M4）
- 想法（待拆）：vitest 测试子集收尾与 dom-setup、手工验收清单执行（含 round-trip 10 次保真、外部编辑冲突）、NOTICE.md + LICENSE（MIT，署名 stablyai/orca）+ README、electron-builder 打包与 Releases 发布

## 未归类
（暂无）

## 已完成
（暂无）
