# Issues

当前批次：B2 已完成（I-007 / I-008 / I-009 / I-010 全部模型验收合并）。下一批待布置

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

### [build]
- I-007 · feature · 完成 · FileService 主进程 IPC 接线（fs 子集 + runtime files.* 路由 + writeIfUnchanged CAS）· 模型验收 · B2 —— 2026-11-22 模型验收合并（A1–A7 探针 7/7；全量 365 过）
- I-008 · feature · 完成 · 文件 watch 与变更事件映射（chokidar → onFsChanged）· 模型验收 · B2 —— 2026-11-22 模型验收合并（探针 6/6；全量 371 过）

### [editor]
- I-009 · feature · 完成 · demo 接真实文件读写与保存队列（writeIfUnchanged + 外部修改横幅）· 模型验收 · B2 —— 2026-11-22 模型验收合并（探针 5/5 + 渲染适配；全量 376 过；dev 冒烟落盘成功）
- I-010 · feature · 完成 · 图片粘贴落盘管线（saveImageAsTempFile + importExternalPaths 两端接线）· 模型验收 · B2 —— 2026-11-22 模型验收合并（探针 4/4；全量 380 过；A2 命名措辞修订见修订表）

### 想法（阶段 2 余量）
- 想法：独立自动保存控制器的参数调优（防抖 / 静默窗口）——内核控制器已随 I-003 迁移，I-009 验证生效后如参数不适再单开
- 想法 · bug：长耗时测试（markdown-preview-table-chunks 单跑 ~6.2s）在 vitest 默认并发池下被资源竞争拖超时偶挂（I-008 期间两轮全量各挂一个不同文件，单跑均过；--maxWorkers=2 稳定全绿）——不做则 CI / 全量回归证据不稳定；处理方向：该测试降敏或调 pool 并发
- 想法 · bug：长耗时测试（markdown-preview-table-chunks 单跑 ~6.2s）在 vitest 默认并发池下被资源竞争拖超时偶挂（I-008 期间两轮全量各挂一个不同文件，单跑均过；--maxWorkers=2 稳定全绿）——不做则 CI / 全量回归证据不稳定；处理方向：该测试降敏或调 pool 并发

## 阶段 3 · 产品外壳（M3）

当前批次：B3 = I-011 → I-012 → I-013 → I-014 → I-015 → I-016 → I-017（串行链；段尾 I-013 / I-017 人验残差，段尾不等）

- I-011 · feature · 进行中 · 文件树与文件夹工作区（打开文件夹 + 树形列表 + watch 刷新）· 模型验收 · B3a
- I-012 · feature · 待办 · 多标签栏（tab bar / 切换 / 关闭 / dirty 标记）· 模型验收 · B3a
- I-013 · feature · 待办 · 三渲染模式（rich / source=Monaco / preview=markdown-preview）· 人验收（残差 1 条：切换观感）· B3a 段尾
- I-014 · feature · 待办 · TOC 面板（标题层级 + 点击跳转）· 模型验收 · B3b
- I-015 · feature · 待办 · 编辑器搜索替换（Ctrl+F / 全部替换）· 模型验收 · B3b
- I-016 · feature · 待办 · 设置面板（自动保存 / 缩放 / 拼写检查）· 模型验收 · B3b
- I-017 · feature · 待办 · 导出 HTML / PDF · 人验收（残差 1 条：导出结果观感）· B3b 段尾

### 想法（阶段 3 余量）
- 想法（待拆）：状态栏增强（模式 / 缩放 / 保存态常显）、双链 useMarkdownDocuments 适配本地 fs、i18n 收尾

## 阶段 4 · 测试收尾与发布（M4）
- 想法（待拆）：vitest 测试子集收尾与 dom-setup、手工验收清单执行（含 round-trip 10 次保真、外部编辑冲突）、NOTICE.md + LICENSE（MIT，署名 stablyai/orca）+ README、electron-builder 打包与 Releases 发布

## 未归类
（暂无）

## 已完成
（暂无）
