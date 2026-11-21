# 架构

## 0. 这份文档写什么、不写什么
**写**：数据流（一张图）、模块分类与依赖方向、架构级红线、关键选择的理由、可观测性总览、交付与升级。
**不写**：做什么与不做什么（→ PRD）；要做什么、什么顺序（→ 看板）；IPC 清单与字段（→ BACKEND）；组件 / 状态 / 数据访问（→ FRONTEND）；界面结构与视觉（→ DESIGN_SYSTEM）；依赖清单（→ package.json）；函数与文件怎么拆（→ 看代码）。
判定：这句话依赖具体代码位置吗？依赖 → 不写，进 issue 的过程记录。

## 1. 数据流

```
磁盘 .md 文件
  → 主进程 FileService.read（IPC）
  → render-mode 资格扫描：rich / source / preview 裁决
  → 编辑器（TipTap）加载 → 用户输入 / IME / 粘贴 / 斜杠菜单
  → 300ms 防抖序列化 → round-trip 引擎（codec + reconcile，块级源码保留）
  → 序列化提交（save/flush：pending-flush / stale-view-edit / discard-epoch）
  → 保存队列 → writeIfUnchanged（compare-and-swap）→ FileService.write → 磁盘
  → watch（chokidar）→ filesystem-change-event → 外部修改横幅 / 双链索引刷新（闭环）
```

一句话：磁盘上的 .md 经 IPC 进入渲染端编辑器，编辑以 300ms 防抖 + 三方 reconcile 回写成字节级保真的文本，watch 闭环感知外部修改。

现状与目标的差距：无，从零搭建（场景①）。迁移件来自 Orca（勘察已完成，源码位置待人提供），按看板阶段 1（编辑器内核可验证）→ 2（文件服务与自动保存）→ 3（产品外壳）→ 4（测试与发布）落地。

## 2. 模块分类与依赖方向
分类框架（按项目定）：主进程 / 渲染端 / 共享。

| 模块 | 在数据流中的职责 | 代码目录 | 允许依赖 | 禁止依赖 |
|---|---|---|---|---|
| build | 构建配置、`@` 别名、依赖补丁 | electron.vite.config.ts、patches/、pnpm-workspace.yaml、tsconfig* | — | — |
| main | FileService、watch、菜单、导出 PDF | electron/main | node、chokidar、shared | `src/*`（渲染端代码）、react |
| bridge | window.api preload 桥（与 Orca 同名 API） | electron/preload | electron | react、`src/*` |
| runtime | 本地文件客户端：把编辑器的文件诉求翻译成 window.api 调用 | src/runtime | bridge 类型、shared | electron 直接调用 |
| editor | 编辑器内核：rich-markdown、markdown、save/flush、document-images、markdown-preview、diagrams、render-mode | src/components/editor | shared、lib、ui、store（props 注入）、i18n、runtime | node / electron 直接调用 |
| ui | shadcn 子集、sonner | src/components/ui | — | editor、store、runtime |
| store | 精简全局态：设置 / 标签 / 脏状态 | src/store | shared | editor 内部实现 |
| app | 产品外壳：文件树 / 标签栏 / 状态栏 / 设置 / TOC / demo | src/app | editor、store、runtime、ui、i18n | node / electron 直接调用 |
| i18n | i18next + zh / en 文案 | src/i18n | — | — |
| shared | 纯逻辑：写盘前置条件、跨平台路径、UTF-8 上限、markdown 扫描器、IME 组合键守卫 | src/shared | shared | electron、react、node API |
| lib | 工具：cn、path、text-search、clipboard | src/lib | shared | — |
| assets | main.css、rich-markdown-editor.css、katex css | src/assets | — | — |

依赖方向：main ← bridge ← runtime ← app / editor；shared / lib 在最底层，不反向依赖；editor 不 import electron。
通信契约按「未来会新增」设计：新增系统能力 = 主进程加 IPC handler + preload 桥加同名方法 + runtime 加客户端函数，纯增量，不改既有编辑器代码。

技术栈：用 X 解决 Y（每条：适用 / 不适用 / 风险）
- **TipTap 3.31.3 + 自定义 marked lexer**：解决 WYSIWYG 与 markdown round-trip 保真。适用：需要块级源码保留的编辑器。不适用：当需要多人实时协作时不得引入（无 OT / CRDT）。风险：锁定版本线，升级必须重跑全量 round-trip 测试。
- **Electron + electron-vite**：解决桌面壳与本地文件访问。不适用：当追求 <100MB 安装包时不得引入。风险：包体大；Chromium 与系统 IME 的组合需实测（AC-06 覆盖）。
- **React 19.2.x（无 Compiler）**：解决视图层。风险：迁移件个别组件若依赖 Compiler 行为，按 Orca 排除名单跳过。
- **Tailwind v4（CSS-first）**：解决样式与主题变量。风险：v4 与 v3 插件生态差异；语义变量表是唯一真源（→ DESIGN_SYSTEM）。
- **zustand**：解决跨组件状态。不适用：需要时间旅行 / 复杂派生链时不得引入。风险：低。
- **Monaco（动态 import）**：source 渲染模式编辑器。风险：包体，只许按需加载。
- **chokidar**：文件 watch。风险：Windows 事件去抖需映射成 Orca 的 filesystem-change-event 语义。
- **vitest + happy-dom**：测试。风险：无法覆盖真实 IME 组合行为；IME 留人验残差。
- **electron-builder（阶段 4）**：打包 NSIS 安装包。风险：不做签名，Windows SmartScreen 会告警（需在 README 说明）。

核心实体与关系：文档（.md 文件，磁盘唯一真源）+ 标签（打开的文档实例，含脏状态）+ 设置（userData/settings.json）。无数据库。

## 3. 架构级红线（约束）

按主题分组：

**模块边界**
- **AC-01** round-trip 保真：序列化提交不得改动未触碰块的字节（块级源码保留）｜机检：迁移的 round-trip 单测 + 重复打开 / 保存 10 次的保真测试
- **AC-02** `@` 别名只指向 `src/`；electron/main 与 electron/preload 不得 import `src/*`｜机检：`grep -rn "from '@/" electron/` 期望空 + 构建分段
- **AC-03** 渲染端触达系统能力只经 `window.api`（preload 桥），渲染端不得直接 `require('electron')`｜机检：`grep -rn "require('electron')\|from 'electron'" src/` 期望空

**数据与写盘**
- **AC-04** 更新已存在文件必走 writeIfUnchanged（compare-and-swap）；直写只用于新建文件｜机检：FileService 冲突路径单测 + 评审核对
- **AC-05** 非 UTF-8 文本 / 超字节上限的文件拒绝进入编辑管线，给出明确错误，不静默截断｜机检：单测（二进制拒绝、UTF-8 上限）
- **AC-06** IME 组合期间不得触发序列化提交；中文输入法打字 / 选字不丢字、不重排｜机检：迁移的 ime 守卫单测；人验残差：中文输入法实测

**范围锁定**
- **AC-07** review 标注与 citations 不回流：扩展注册表不含 annotation / superscript 条目，仓库无 review/ citations/ 目录｜机检：`grep` 注册表与目录
- **AC-08** 大依赖（mermaid、Monaco、emoji-picker）只许动态 import｜机检：`grep -E "^import .* from '(mermaid|@monaco-editor|emoji-picker)"` 期望空（动态 `import()` 除外）
- **AC-09** 无网络后端：一切文件访问走本地 IPC，首期不新增网络服务依赖｜机检：评审核对 package.json 新增依赖

## 4. 关键选择的理由
- **最小改写 + 保持 Orca 的 `@` 别名语义**：迁移面约 28.7k 行，重命名 / 重构会重引入已修复的 bug。否决「大规模重构」（工作量大、保真风险高，违背核心验收标准）。
- **TipTap 3.31.3 按 Orca 版本锁定 + 3 个官方补丁**：round-trip 引擎与该版本行为绑定。否决「升级到最新 TipTap」（序列化行为差异会破坏字节级保真）。
- **主进程 FileService 照抄 Orca `files.*` RPC 语义**：接缝 1:1 对应，迁移件里的 `window.api.*` 调用零改动。否决「重新设计文件 API」（每处差异都是潜在保真 bug）。
- **React 19 无 Compiler**：降低迁移变量。否决「照搬 Orca 的 React Compiler」（构建复杂度上升，收益不面向用户）。
- **zustand 精简 store + props 注入**：只保留设置 / 标签 / 脏状态。否决「全量照搬 Orca store」（携带 review / diff 等被砍功能的动作，与 AC-07 冲突）。
- **Electron 而非 Tauri**：Orca 的 preload 桥模式与 IPC 语义直接对应。否决「Tauri」（WebView 差异导致 IME、剪贴板行为全部重验，违背最小改写）。
- **三渲染模式资格裁决照抄 Orca**：含 HTML / 脚注 / 引用链接的文档自动降级 source，防 round-trip 损坏；这是「不做破坏性编辑」的架构级保证，不自造判定规则。

## 5. 可观测性总览
- 档位：单机桌面（本地小工具档）
- 日志去向与查询入口：主进程日志写 `userData/logs/`；渲染端错误经统一出口（FRONTEND §5）汇总进主进程日志；无远程上报。查询 = 设置面板「打开日志文件夹」。
- 事件 / 错误码目录：`src/shared/error-codes.ts`（暂定，执行期建；IPC 错误契约 = Promise reject `{code, message}`）

## 6. 交付与升级
- 分发形态：装到自己的机器 + GitHub Releases 公开下载（第一期；推荐默认，待确认）
- 制品怎么到用户手里：GitHub Releases 直链（electron-builder NSIS 安装包）。选它：零托管成本、版本可回溯。否决 npm 分发（桌面应用不适用场景）。
- 怎么换版本：用户手动下载新版安装包覆盖；不做自更新器（PRD「不做」）
- 发坏了怎么退：Releases 保留全部历史版本，回滚 = 装回旧版安装包；应用无自有数据存储（用户的 .md 文件即数据），新旧版本读同一份文件，无数据迁移问题
