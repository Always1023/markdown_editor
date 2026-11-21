# 后端工程：markdown_editor（暂名）

> 本项目无网络后端；「后端」= Electron 主进程（electron/main）。通用规则见《后端工程规范》；本文件只写本项目与默认不同的地方。
> 每个单位都写「代码位置」：目录 / 文件；没有额外约定的单位写"按 04 默认"，不硬造。

## 1. 模块
- 代码位置：electron/main（FileService、watch、菜单、导出）、electron/preload（桥）
- 模块清单与职责：FileService（文件 CRUD + watch）、shell（对话框 / 打开文件）、clipboard（文本与图片）、export（printToPDF）、menu（原生菜单与上下文菜单）
- 与 ARCHITECTURE 模块分类的对应：main + bridge

## 2. 接口与契约
- 代码位置：electron/preload 的类型声明（类型唯一真源）
- 对外接口：IPC channels 与 Orca `files.*` 一一对应——read / stat / listMarkdownDocuments / write / writeIfUnchanged / createFile / createDir / createDirNoClobber / rename / copy / delete / watch / unwatch / importExternalPaths；另有 shell.pickImage / openFileUri / openInFileManager、ui.writeClipboardText / saveClipboardImageAsTempFile、export.htmlToPdf、原生上下文菜单三件套
- 事件：filesystem-change-event（chokidar 事件映射成 Orca 事件语义，主进程 → 渲染端单向）
- 错误契约：Promise reject `{code, message}`；错误码目录 src/shared/error-codes.ts（执行期建）

## 3. 数据与存储
- 代码位置：electron/main（FileService 实现）
- 存储选型：无数据库。用户磁盘上的 .md 与图片即数据；应用设置存 userData/settings.json
- 核心表 / 实体：无
- 索引、软删、迁移策略：无（应用内数据库在 PRD「不做」）

## 4. 用例
- 代码位置：electron/main；compare-and-swap 语义随迁移件在 src/shared/file-write/
- 事务边界、校验位置、幂等键：更新已存在文件必传「预期磁盘内容」做 compare-and-swap（AC-04）；UTF-8 字节上限与二进制拒绝在写入前校验（AC-05）

## 5. 后台任务
- 代码位置：electron/main（watcher）
- 任务清单、重入 / 锁、死信：watch（chokidar）常驻，支持 watch / unwatch；保存队列在渲染端串行化，主进程只做单次原子写，无后台队列

## 6. 外部依赖
- 代码位置：electron/main
- 第三方、超时、重试、降级、熔断：chokidar；无网络依赖（AC-09），无超时 / 熔断需求

## 7. 错误与状态
- 代码位置：electron/main；错误码目录 src/shared/error-codes.ts（执行期建）
- 错误码目录：见 §2 错误契约
- 对外文案与可重试性：文件冲突类可重试（先重读再写）；权限 / 不存在类不可重试，直接提示文案

## 8. 鉴权与权限
- 代码位置：—
- 使用主体：单人自用（本地单机）
- 账号 / 角色 / 数据范围：无账号；只访问用户显式打开的文件夹
- 明确不做：不做角色 / 组织 / 成员邀请 / 云端权限（与 PRD「不做」一致）

## 9. 配置与密钥
- 代码位置：electron/main（settings 读写）
- 配置项、密钥来源、启动检查：无密钥；设置项 = 拼写检查 / 字体缩放 / 默认模式 / 主题 / 语言（F11）

## 10. 日志、指标与告警
- 代码位置：electron/main（logger）
- 档位：单机
- 事件目录 / 错误码目录：src/shared/error-codes.ts（执行期建）
- 去向与格式：主进程日志 → userData/logs/（JSON lines）
- 保留、采样、脱敏：滚动保留；不记录文件内容，只记路径与错误
- 查询入口：设置面板「打开日志文件夹」
- 告警：无

## 11. 数据迁移
- 代码位置：—
- 迁移工具、回滚、大表策略：无（无自有数据；用户 .md 文件即数据）

## 12. 测试
- 代码位置：tests/ 与被测文件同目录（vitest）
- 契约、复现、外部依赖替身、关键路径：writeIfUnchanged 冲突路径（临时目录）、二进制拒绝、UTF-8 上限、watch 事件映射；真实磁盘用临时目录替身，测后清理
