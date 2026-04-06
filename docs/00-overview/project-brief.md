# 项目简介

## 一句话

一个桌面端 Chrome 扩展，让 AO3 用户根据个人 tag 规则对作品进行高亮、警示、弱化或折叠。

## 要解决的问题

AO3 列表页 tag 密度高，用户扫读成本大、容易漏看关键信息，现有的 userscript / site skin 方案门槛高且不够即时。

## 解决方式

在 AO3 页面上注入轻量覆盖层：

1. 解析 relationship / character / freeform tag。
2. 用用户定义的规则（精确 / 包含 / 通配符）进行匹配。
3. 执行四种 action — **highlight / warn / mute / hideWork**。
4. 在每个 tag 上提供悬停按钮，一键创建规则。

## 目标用户

- 靠 tag 做阅读决策的读者
- 有明确雷点需要快速识别的读者
- 高频刷列表、希望降低认知负荷的读者

## 当前阶段

MVP 规划 → 初始实现。文档先行，尚无代码。

## 非目标（MVP）

移动端交互 · 云同步 / 登录 · AI 推荐 · 跨浏览器 · 复杂布尔规则表达式

## 关键文档

| 内容 | 位置 |
|---|---|
| 产品需求 | `docs/10-product/prd.md` |
| MVP 范围 | `docs/10-product/mvp.md` |
| 版本路线 | `docs/10-product/roadmap.md` |
| 架构与数据模型 | `docs/20-architecture/system-overview.md` |
| 任务清单与优先级 | `docs/30-planning/backlog.md` |
| 验收标准 | `docs/40-quality/definition-of-done.md` |
| 当前活跃任务 | `docs/30-planning/active/2026-04-ao3-plugin-mvp/` |
