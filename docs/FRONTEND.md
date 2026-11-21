# 前端工程：markdown_editor（暂名）

> 通用规则见《前端工程规范》；本文件只写本项目与默认不同的地方。
> 每个单位都写「目录 / 文件」；样式与令牌见 DESIGN_SYSTEM；没有额外约定的单位写"按 05 默认"。

## 1. 入口与路由
- 目录 / 文件：src/main.tsx（渲染端入口）、src/app/
- 路由 / 布局 / 页面壳：无 URL 路由；单窗口 = 左文件树 / TOC + 中标签栏 / 编辑区 + 底状态栏 + 设置抽屉；多标签是应用内部状态
- 权限入口：无（无账号，个人单机产品）

## 2. 组件边界
- 目录 / 文件：src/components/editor（迁移的编辑器子系统，内部结构保持 Orca 原样）、src/components/ui（shadcn 子集）、src/app（外壳）
- 组件目录、顶层组件、浮层：浮层 = 斜杠菜单、`[[` 补全、emoji 面板（均随迁移件）；原生上下文菜单走 window.api

## 3. 状态归属
- 目录 / 文件：src/store/index.ts（精简 zustand）
- 局部 / 跨组件 / 全局 / URL / 服务端：文档内容状态归编辑器子系统（300ms 提交模型），不进全局 store；全局 store 只有设置 / 标签列表 / 脏状态 / 主题 / 语言；无 URL 状态、无服务端状态

## 4. 数据访问
- 目录 / 文件：src/runtime/files/*
- 数据层、缓存、错误分类：组件不直接调 window.api，一律经 runtime 客户端；错误按 `{code, message}` 分类，文件冲突类可重试（先重读再写）

## 5. 运行时错误与日志
- 目录 / 文件：src/main.tsx（全局出口）+ 编辑器子系统错误边界
- 全局错误出口：window error + unhandledrejection → 统一汇总经 IPC 写主进程日志
- 上报去向 / 采样 / 开关：仅本地日志，无远程上报
- trace 关联：无（单机，无分布式 trace）

## 6. 复用单元
- 目录 / 文件：src/lib（cn、path、text-search、IME 组合键守卫、clipboard-image、markdown-code-languages）
- hook / composable / 工具：编辑器子系统自带 hooks 随迁移件走，不外提复用

## 7. 样式与令牌
- 目录 / 文件：src/assets/main.css（Tailwind v4 @theme + 语义变量表）
- 见 DESIGN_SYSTEM.md；本文件只写代码层约定：Tailwind v4 CSS-first，禁止散落硬编码色值（AGENTS §11）

## 8. 测试与目录
- 目录 / 文件：测试与被测文件同目录（随迁移件）
- 测试位置、e2e、目录：vitest + happy-dom，测试文件自带 `@vitest-environment` 注释；首期无 e2e
