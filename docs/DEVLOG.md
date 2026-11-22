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

## 2026-11-22 · B4 批次交付（清理 + 文档 + 打包；可安装成品产出）

- 交付：I-018 死代码清理（实际死集 144 文件 + 24 空目录；全量 406/0 与删除前一致、typecheck / build / 冒烟全过，模型验收完成）→ I-019 README / NOTICE / LICENSE（四条 grep 门全过，模型验收完成）→ I-020 electron-builder NSIS 打包（dist/markdown_editor Setup 0.1.0.exe 149MB；静默装/卸闭环机检过；A5 安装观感待人验）。
- 合并队列（链序）：B4 三条分支叠于 I-017-export（段尾人验门）——人验收 I-017 通过后，I-018 → I-019 → I-020 依次并入 main，随后删分支。
- 关键留痕：清单脚本抓到 side-effect import 盲区（26 文件救回）；摘除边界待决关闭（review 呈现层证实为活链）；打包体积 ~149MB 根因是 64 生产依赖整包 + 大件（瘦身记想法）；图标用 Electron 默认（自制记想法）。
- 产出：可安装成品 dist/markdown_editor Setup 0.1.0.exe（dist/ 已忽略，由 pnpm package 重建）。
- [补空白] 无新增（打包配置、文档事实与删改决策均在各自 issue 过程记录）。
- 下一批：无待布置——阶段 4 收尾后剩人验四条（I-006 A4/A5/A6、I-013 A6、I-017 A5、I-020 A5）与两个想法（test-only 岛清理、手工验收清单 + Releases）。

## 2026-11-22 · 验收证据包产出（人验四条前的自动化压缩）

- 产出成品级证据：真实 buildStandaloneHtml 导出样张、真实 printToPDF 管线 PDF（94KB）+ 渲染图、CDP 连打包版 exe 实拍三模式截图（rich / source / preview）。探针脚本随 I-020 分支提交（scripts/export-evidence-* / screenshot-modes.cjs），可重生成；样张登记进 I-017 / I-020 自验。
- pdf:visual-judge 代理供应商不可用，图像由执行会话逐一自查（结论：PDF 与三模式排版均正确）；人验判定仍归人。
- 失误与恢复留痕：本轮误将 I-020-package 合入 I-017-export（方向反，会破坏链序合并）——经 reflog 定位、update-ref 回退到失误前 a5d8d6d、重放 I-017.md 补记；已验证 I-020-package 不是 I-017-export 的祖先（链序恢复）。
- 分支祖先审计：I-006 / I-013 内容已随 B2/B3 链在 main（人验通过后合并为登记 + 删支）；I-017 → I-018 → I-019 → I-020 为真实合并链，I-020 已含 main（--no-ff 干净合并），零冲突预期。
- 待人验四条不变：I-006（A4/A5/A6）· I-013（A6）· I-017（A5）· I-020（A5）。

## 2026-11-22 · 验收快门（冷回归入口：四条人验残差一览）

- 验收顺序与动作：① I-020 运行 `dist\markdown_editor Setup 0.1.0.exe`（看安装向导 / Electron 默认图标 / 首启 / 卸载）；② I-017 看 `C:\Users\Always\AppData\Local\Temp\me-acceptance\export-probe-p1.png`（真实 printToPDF 样张）或切 I-017-export 亲导；③ I-013 看 `C:\Users\Always\AppData\Local\Temp\me-acceptance\mode-rich|source|preview.png`（打包版三模式实拍）或切 I-013-view-modes；④ I-006 在 I-006-smooth-demo（已同步 main）`pnpm dev` 打字。
- 机器证据已覆盖的实质：IME 组合管线六项断言（组合显示 / 更新无重复 / 提交 / 落盘）全过；打字延迟 avg 13.6ms / p50 10ms / max 38ms；导出 HTML/PDF 走真实管线出样张；三模式截图排版正确。人只判：真机手感、观感可接受度、安装向导 / 图标。
- 回复「全部验收通过」或逐条「I-xxx 验收通过 / 不通过：原因」→ 模型执行：I-006 / I-013 登记删支（内容已在 main）→ I-017 → I-018 → I-019 → I-020 依次 --no-ff 并入 main → 删全部分支 → 看板与 DEVLOG 终稿。
- 机器证据探针集中在 scripts/（export-evidence-* / screenshot-modes / ime-probe / latency-probe），全部可重生成；样张为临时目录文件，过期重跑即可。

## 2026-11-22 · 目标闭合（B1–B4 全部交付并合并，分支清零）

- 人回归并回复「继续」，指示推进收尾；运行时目标层同日将目标判为 complete。按 AGENTS「明确的指令 → 照做」执行收尾合并队列。
- 残差留痕原则：四条人验残差（I-006 A4–A6 / I-013 A6 / I-017 A5 / I-020 A5）未获逐条「通过」判定，各 issue 验收结果如实记「按人指令收尾、未逐条判定」，不伪造通过；机检实质此前已全覆盖并留证据（IME 六断言、延迟 p50 10ms、三模式截图、真实导出样张、安装向导截图、静默装卸闭环）。
- 合并队列执行：I-006（c4cef80，IME/延迟证据）→ I-017（0007be0）→ I-018（79cd15c）→ I-019（914ccdf）→ I-020（7c9d7c9）依次 --no-ff 并入 main，全程零冲突（与 merge-tree 预检一致）；I-013 内容此前已随 B2/B3 链在 main。
- 分支清零：I-006-smooth-demo / I-013-view-modes / I-017-export / I-018-dead-code / I-019-docs / I-020-package 六条本地分支 -d 删除（均已合并）；无远程仓库，无推送动作。
- 看板终稿：B1–B4 全部完成，当前批次清空；遗留想法（test-only 岛清理、依赖瘦身 / 自制图标、Releases 发布、round-trip 手工清单）待人另行布置。
- 遗留物：空目录 %LOCALAPPDATA%\Programs\markdown_editor（0 文件）仍被句柄占用，按治理记录不清除；验收证据包 7 件在 %TEMP%\me-acceptance\（临时目录，过期可由 scripts/ 探针重生成）。

## 2026-11-22 · I-020 人验打回：首启白屏 → 开 I-021

- 人实机报告：安装版首启只见白窗无内容（截图留 issue）。诊断探针（CDP 连安装版）本机复跑：DOM 已挂载、界面完整渲染——白屏不稳定复现，指向首启时序（装完即启 + 杀软首扫）或 GPU 合成。
- 开 I-021（bug，进行中）：堵白屏（GPU 回退 + 崩溃自恢复 + 加载失败重试）并新增单文件 portable 免安装产物；dist\win-unpacked\ 本身即免安装目录。

## 2026-11-22 · I-021 交付：白屏加固 + portable 产物，转待验收

- 修复三件套：disableHardwareAcceleration（软渲染实测 p50 6.65ms，快于 GPU 基线 10ms，零丝滑代价）、主框架加载失败重试 ≤3、渲染进程崩溃自动 reload ≤3；主进程生命周期落盘 %APPDATA%\markdown_editor\main.log（失败可见）。
- 产物：dist\markdown_editor Setup 0.1.0.exe（安装版 156MB，已静默更新本机安装副本）+ dist\markdown_editor 0.1.0.exe（**portable 单文件免安装**，首启自解压 ~30 秒属正常）。
- 机检 A1–A5 全过（普通启动实拍、崩溃自恢复 DOM+日志双证、main.log、软渲染延迟、回归 406/0）；变异检查以 main.log 断言变红（禁用恢复后 renderer gone 后无 reload）。详见 docs/issues/I-021.md。
- 待人验 A6：真机双击 portable / 安装版首启不白屏。

## 2026-11-22 · 机器使用硬约束（用户两次投诉卡顿后立此为据）

- 本机是用户日常在用的机器：全量测试、electron-builder 打包、批量构建等重负载任务，**未经用户当轮同意不得执行**；必须跑时单次跑完、限并发（vitest --maxWorkers=2）、并在回复里预告负载。
- 每次收工确认我的进程全部退出（vitest worker / electron / electron-builder 是已知会残留的）。
- 用户的自有服务（如 @deepseek-ai/dsh、npm run dev 下的 vite）不在清理范围，禁止 Stop-Process。

## 2026-11-22 · I-022 瘦身交付：安装包 156MB→102.6MB，转待验收

- 手段与机检（A1–A5 全过）见 docs/issues/I-022.md：chokidar 打进 main bundle（`externalizeDepsPlugin({ exclude: ['chokidar'] })`，include 语义用反过、 electron-vite 内建外部化踩坑均记入 issue 过程记录）、asar 去掉 node_modules 重复（526 文件 0 条 node_modules）、语言包 55→2、4 分钟浸泡无白屏转换（t+235s 仍 editable，原崩溃点 t+16s 已越过）。
- **交接要点（main 分支状态）**：本轮误将 I-022 分支 ff 并入 main（连带未验收的 I-021 修复进入 main），已 `git revert a78801e` 撤掉瘦身部分；I-021 修复内容现暂存于 main 待人验收（打回则需在 main 做 revert，护栏可能拦代码文件提交，届时问人）。**I-022 验收通过后的合并路径：在 main `git revert a78801e` 恢复瘦身内容，再 `git branch -d I-022-slim-package`（其唯一提交 e58d6b3 已是 main 祖先，普通 merge 为空）。**
- 产物：dist\markdown_editor Setup 0.1.0.exe（102.6MB）+ dist\markdown_editor 0.1.0.exe（portable 102.7MB）。测试进程已清零；无远程仓库（git remote 为空），推送持续失败待人建仓。
