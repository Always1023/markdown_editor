# markdown_editor

一个「丝滑」的本地 Markdown 桌面编辑器——把 [Orca](NOTICE.md)（MIT）验证过的编辑子系统抽成独立产品：**怎么编辑都不重排你手写的格式**。

## 功能

- 富文本编辑（TipTap）· 源码模式（Monaco）· 预览三种渲染模式随时切换
- 手写格式保真：300ms 防抖提交 + 三方 reconcile + IME 组合键守卫，round-trip 单测守护
- 文件树工作区、多标签、目录（TOC）面板、搜索替换、图片粘贴自动落盘
- 保存走 CAS 队列（writeIfUnchanged），外部修改有横幅对比，自动保存可关
- 导出 HTML / PDF（系统保存对话框）

## 快速开始

```bash
pnpm install
pnpm dev        # 启动 Electron 桌面应用
```

开发环境（本项目验证过的版本）：Windows、node v24.21.0、pnpm 10.32.1、git 2.47.1。

## 常用命令

| 命令 | 做什么 |
|---|---|
| `pnpm dev` | 启动桌面应用（electron-vite dev） |
| `pnpm build` | 构建 main / preload / renderer 三段 |
| `pnpm typecheck` | 双 tsconfig 类型检查 |
| `pnpm test` | 全量测试（vitest + happy-dom，测试与被测文件同目录）；稳定全绿建议 `npx vitest run --maxWorkers=2` |
| `pnpm package` | 打包 Windows 安装包（electron-builder，产出在 dist/） |

## 代码结构

| 目录 | 是什么 |
|---|---|
| `src/app/` | 外壳装配：App、文件 IO 链、设置持久化、导出客户端 |
| `src/components/editor/` | 编辑子系统（自 Orca 迁移）：rich-markdown、markdown-preview、Monaco 源码模式、save queue |
| `src/store/` | zustand store + Orca compat 层 |
| `electron/main/` | 主进程：fs IPC、watch、导出（printToPDF） |
| `docs/` | 规划文档：PRD、ARCHITECTURE、看板（ISSUES）、issue 文件、DEVLOG |

## 文档

- [docs/PRD.md](docs/PRD.md)——做什么、不做什么、怎么算成功
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)——数据流、模块边界、架构红线
- [AGENTS.md](AGENTS.md)——人 / 规划 / 执行 / 审计四角色的协作规则与 issue 流程
- [docs/ISSUES.md](docs/ISSUES.md)——看板（状态唯一来源）

## 许可

MIT。本项目衍生自 Orca（stablyai/orca，MIT），衍生与摘除范围见 [NOTICE.md](NOTICE.md)。
