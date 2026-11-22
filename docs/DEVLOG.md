# DEVLOG

## 2026-11-22 · B1 批次完成（I-001～I-005 合并，I-006 待验收）
- B1 六条按链序提交：I-001 脚手架 → I-002 shared/assets → I-004 store/i18n → I-005 preload 桥 → I-003 编辑器内核 → I-006 demo。前五条模型验收通过并合并 main；I-006 在分支 I-006-smooth-demo 待人验收（残差 3 条：A4 中文输入法 / A5 手感 / A6 观感）。
- 三件套全绿：typecheck 0 错、build exit 0、test 358 用例 0 失败（86/88 文件，2 skipped 为 layout-owner main 分支）。
- 本轮关键修复：runtime-rpc-call 恢复 Orca local 路由（blob 图片管线）、compat setActiveWorktree 激活语义、hydrateTabsSession 本地子集、diff-comments 切片并入、宿主通道「无通道即跳过」守卫。
- 待决新增一条：摘除边界重审（review 呈现层 / diff-comment 死代码），默认随阶段 4 清理；详见 I-003 / I-004 验收结果表。
- dev 冒烟通过（Electron 三段 + 模块链转译）；无远程仓库，全部提交仅在本地下。

## 2026-11-22 · B2 批次布置（阶段 2：文件服务与自动保存）
- 批量盘点：B1 已交付（I-001~I-005 合并；I-006 待验收不阻塞后续段尾）；阶段 2 想法拆为 B2 = I-007 FileService IPC → I-008 watch → I-009 demo 真实读写 → I-010 图片落盘，按依赖链序逐条做（I-008 / I-010 触达不相交可并行）。执行方式：先写集成探针测试（临时目录 + 清理）再接线；审计安排：I-007 的 CAS / 越权拒绝为高风险点，接线完成后跑边界探针。顺延项：I-006 人验残差继续等人；阶段 3 外壳想法待拆。
- 信息需求（不答按默认）：图片落盘目录 = 文档同目录（跟随 Orca dirname 语义）；watch 防抖 = 跟随 Orca watcher 参数；demo 打开文件入口 = 启动读工作目录 welcome.md（无则创建）+ 拖拽。

## 2026-11-22 · B2 批次完成（模型盘点确认记录）

- B2 四条全部模型验收合并：I-007（FileService IPC + writeIfUnchanged CAS）、I-008（chokidar watch → FsChangedPayload）、I-009（demo 真实文件 IO + 保存链 + 外部修改横幅）、I-010（图片粘贴落盘管线）。全量 380 过 / 0 失败，typecheck 0 错，build exit 0。
- 关键修复留痕：MARKDOWN_EDITOR_ROOTS 分号分割（盘符冒号）、fs-watch 等 ready 再订阅（初始扫描吞写入）、runtime:call 包 envelope（callRuntimeRpc 依赖）、import 来源放行系统 tmp（截图临时文件）、saveImageAsTempFile 命名贴 Orca（orca-paste-<now>-<rand>）。
- 验收标准修订 1 条：I-010 A2 命名措辞（pasted-N → orca-paste 语义，意图不变），修订表留痕。
- 待验收：I-006（残差 3 条：A4 中文输入法 / A5 手感 / A6 观感；真机粘贴体验并入 A5）。
- [补空白] 无新增（安装 demo 工作区 / editor 装配层做法已在 I-009 过程记录）。
- 下一批：阶段 3 外壳（文件树 / 多标签 / 三模式 / TOC / 设置 / 搜索 / 导出）待布置；模块顺序建议先 editor 侧（TOC / 搜索 / 预览）再 shell 侧（文件树 / 标签）。

## 2026-11-22 · B3 批次完成（布置盘点补记 + 交付）

- 布置（本条补记）：阶段 3 外壳拆为 B3 = I-011 文件树 → I-012 多标签 → I-013 三渲染模式 → I-014 TOC → I-015 搜索 → I-016 设置 → I-017 导出，串行链、段尾 I-013 / I-017 人验残差、段尾不等。
- 交付：I-011 / I-012 / I-014 / I-015 / I-016 模型验收合并 main；I-013（分支 I-013-view-modes）与 I-017（分支 I-017-export）转待验收，分支保留。全量 98 文件 406 过 / 0 失败，typecheck 0 错，build exit 0，每条均过 dev 冒烟。
- 关键修复留痕：Monaco 只动态 import（AC-08，独立 chunk）；UI 面未接线通道（ui.setMarkdownEditorFocused 等）optional-chain 守卫；review 呈现层 / 聊天引用摘除边界落成 10 个 no-op 适配器（预览树全链可渲染）；filePath 分隔符统一 norm 比较；global store 用例间重置。
- 待验收：I-006（残差 3 条）+ I-013（A6 切换观感）+ I-017（A5 导出观感）。
- [补空白] 2 条（待同步 ARCHITECTURE，进入规划模式时补）：① compat 层补 setEditorFontZoomLevel（Orca ui-slice 逐字语义，会话级不持久化，见 I-016 过程记录）；② 导出落盘通道 fs:exportDocument 不做工作根越权检查（路径来自系统保存对话框，用户选择即授权，与 fs:writeFile 的差别见 I-017 过程记录）。
- 下一批：阶段 4 测试收尾与发布（死代码清理 / README / NOTICE / LICENSE / electron-builder 打包），待布置。

## 2026-11-22 · B4 批次布置（阶段 4：清理与打包）

- 批量盘点：B3 已交付（I-013 / I-017 待验收不阻塞后续）；阶段 4 按人指令（死代码清理、README/NOTICE/LICENSE、electron-builder 打包成可安装成品）拆为 B4 = I-018 → I-019 → I-020 串行链，段尾 I-020 人验残差 1 条。
- 依据：I-018 先做可达性全图（Explore，2,954 文件静态 import 图）——死集 549 文件删、test-only 岛 501 模块与 src/preload 类型面保留；原「review 呈现层是死代码」判断不成立（活链），待决关闭。
- 信息需求（不答按默认）：打包目标 = Windows NSIS（本机 win32）；版本号 = package.json 0.1.0；图标 = 暂用 Electron 默认（自制记想法）；发布 = 不做（无远程仓库）。
- 执行方式：I-018 清单脚本 [先写]（脚本断言活/死分类，删除后四道门：无残留引用 / typecheck / 全量回归 / build+冒烟）；I-019 / I-020 按各自 issue 机检清单走。
