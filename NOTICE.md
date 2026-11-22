# NOTICE

本仓库包含对 Orca（stablyai/orca，MIT License）编辑子系统的迁移与改写。Orca 的 MIT 许可对其原始代码继续生效；本项目的改写部分按同许可（见 [LICENSE](LICENSE)）分发。

## 迁移范围（保留）

- 编辑子系统：TipTap 富文本编辑、Monaco 源码模式、markdown-preview 渲染链、markdown round-trip 保真管线
- 保存队列：writeIfUnchanged CAS、编辑器自动保存控制器、外部修改横幅
- document-images 图片落盘管线、多标签 / TOC / 搜索 / 设置 / 导出相关模块
- store compat 层与 preload 类型契约面（按本产品需要精简成员）

## 迁移时摘除（不在本产品中运行）

- review 呈现层——以 no-op 适配器占位（摘除边界，接口保留、行为为空）
- citations（引文）模块
- multi-host SSH 与远端 runtime 面
- combined-diff / Monaco DiffViewer 链
- 终端（PTY）与 floating-terminal
- 插件宿主（plugins 加载器）与 native-chat 聊天面板

以上摘除为最小改写策略的一部分：接口位置保留、实现为空或未接线，调用即失败可见。逐 issue 的摘除决策记录见 `docs/issues/`。
