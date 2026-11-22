# Issues

当前批次：B4 = I-018 死代码清理 → I-019 README/NOTICE/LICENSE → I-020 打包（段尾；串行链，I-020 含人验残差）。B3 已交付（I-011 / I-012 / I-014 / I-015 / I-016 合并；I-013 / I-017 待验收）

## 待决问题
- ~~摘除边界重审（关联 I-003 / I-004）~~ 已关闭（2026-11-22，I-018 可达性全图）：review 呈现层（rich-markdown/review/ 19 文件）与 diff-comment store 切片均被证实是活编辑器链的一部分（原「3 文件死代码」判断不成立）；摘除边界由 I-013 落成的 no-op 适配器承载，无需清理。

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
- I-003 · feature · 完成 · 编辑器子系统迁移，摘除 review / citations（依赖 I-002 / I-004 / I-005）· 模型验收 · B1 —— 代码与测试全绿；摘除边界重审已关闭（2026-11-22 I-018 全图证实 review 呈现层为活链，no-op 适配器承载摘除边界，见待决区）

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

## 阶段 3 · 产品外壳（M3）

当前批次：B3 已交付（2026-11-22；串行链走完，段尾不等生效——I-013 / I-017 待验收与后续工作并行）

- I-011 · feature · 完成 · 文件树与文件夹工作区（打开文件夹 + 树形列表 + watch 刷新）· 模型验收（2026-11-22 自验 5 条全过）· B3a
- I-012 · feature · 完成 · 多标签栏（tab bar / 切换 / 关闭 / dirty 标记）· 模型验收（2026-11-22 自验 6 探针全过）· B3a
- I-013 · feature · 待验收 · 三渲染模式（rich / source=Monaco / preview=markdown-preview）· 人验收（残差 1 条：切换观感 A6，2026-11-22 机检 A1-A5 全过）· B3a 段尾
- I-014 · feature · 完成 · TOC 面板（标题层级 + 点击跳转）· 模型验收（2026-11-22 自验 3 探针全过）· B3b
- I-015 · feature · 完成 · 编辑器搜索替换（Ctrl+F / 全部替换）· 模型验收（2026-11-22 自验 3 探针全过；入口 UI 已随编辑器装配）· B3b
- I-016 · feature · 完成 · 设置面板（自动保存 / 缩放 / 拼写检查）· 模型验收（2026-11-22 自验 3 探针全过）· B3b
- I-017 · feature · 待验收 · 导出 HTML / PDF · 人验收（残差 1 条：导出结果观感）· B3b 段尾（2026-11-22 机检 A1-A4 全过，406/0）

### 想法（阶段 3 余量）
- 想法（待拆）：状态栏增强（模式 / 缩放 / 保存态常显）、双链 useMarkdownDocuments 适配本地 fs、i18n 收尾
- 想法：外壳文案接 useTranslate（关联 I-012，硬编码中文集中在 App / TabBar / FileTree / 设置；不做则 i18n 收尾漏掉外壳层）

## 阶段 4 · 测试收尾与发布（M4）

当前批次：B4 = I-018 → I-019 → I-020（串行链；段尾 I-020 人验残差）

- I-018 · 重构 · 待办 · 死代码清理（可达性全图：死集 549 文件；test-only 岛与 preload 类型面保留）· 模型验收（行为不变）· B4
- I-019 · feature · 待办 · README / NOTICE / LICENSE（MIT，署名 stablyai/orca）· 模型验收 · B4
- I-020 · feature · 待办 · electron-builder 打包（NSIS 安装包 + 静默装/卸闭环；不做 Releases——无远程仓库）· 人验收（残差 1 条：安装与首启观感）· B4 段尾

### 想法（阶段 4 余量）
- 想法（待拆）：test-only 岛清理（501 模块：monaco DiffViewer 链 + diff-comments 组件 11 文件 + floating-terminal / viewer-viewport / csv / loading 等）——锚定 3 个活代码 save-queue 测试，删除需重写其 fixture；不做则测试面继续背死代码
- 想法：手工验收清单执行（round-trip 10 次保真、外部编辑冲突）与 Releases 发布（等远程仓库定下再开）

## 未归类
（暂无）

## 已完成
（暂无）
