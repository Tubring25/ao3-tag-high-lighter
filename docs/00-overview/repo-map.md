# 仓库地图

## 根目录

| 文件 | 用途 |
|---|---|
| `AGENTS.md` | Agent 共享入口规则（所有 AI agent 首先读这个） |
| `CLAUDE.md` | Claude 专属补充说明，引用 AGENTS.md |
| `README.md` | 项目介绍（给人看的） |

## 文档目录

| 目录 | 内容 |
|---|---|
| `docs/00-overview/` | 项目简介、仓库地图、术语表 |
| `docs/10-product/` | 产品需求、MVP 范围、版本路线 |
| `docs/20-architecture/` | 系统架构、约束、ADR |
| `docs/30-planning/` | 任务清单、里程碑、活跃任务 |
| `docs/40-quality/` | 完成标准、测试策略、手动测试、bug 记录 |
| `docs/50-progress/` | 变更日志、周报、发布记录 |
| `docs/60-research/` | 调研发现、参考资料 |
| `docs/_templates/` | 文档模板 |

## 活跃任务

当前进行中的任务在：

    docs/30-planning/active/2026-04-ao3-plugin-mvp/

包含 checklist / handoff / decisions / plan / brief / notes。

## 代码目录（计划中）

```
src/
  background/    → service worker
  content/       → AO3 页面注入（解析、渲染、hover 菜单）
  core/          → 纯逻辑（类型、规则引擎、通配符、优先级）
  storage/       → chrome.storage 封装
  popup/         → 扩展弹窗 UI
  options/       → 规则管理页 UI
  shared/        → 常量、消息类型、工具函数
  styles/        → content script CSS
```

## 其他

| 目录 | 用途 |
|---|---|
| `scratch/` | 临时草稿、实验代码，不进正式结构 |
| `.claude/` | Claude Code 配置 |
| `.codex/` | Codex 配置 |
