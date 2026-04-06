# 工作笔记

## 2026-04-05

- 完成文档骨架搭建
- 从功能总结 / 开发视角两份源文档拆分到各目录
- AGENTS.md 初版完成
- 确定技术决策：Vite + Vitest + vanilla DOM + Shadow DOM

## 2026-04-07

- 新增 review 文档：`review-2026-04-07-claude-progress.md`
- 记录当前实现评审结论：工程基线正常，但 `ruleEngine` 尚未把多规则命中收敛为最高优先级 action
- 记录测试风险：`ao3Parser` 当前仍以 happy path 测试为主，缺少边界与真实页面 fixture 覆盖
