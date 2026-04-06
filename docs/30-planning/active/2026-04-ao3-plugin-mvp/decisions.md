# 决策记录

## D001 — UI 不用框架

**日期：** 2026-04-05
**决策：** MVP 阶段 popup / options / 页面内菜单全部用 vanilla DOM + CSS，不引入 React / Vue。
**理由：** 页面量小、交互简单，引入框架增加打包体积和复杂度，收益不大。

## D002 — Content script 悬停菜单用 Shadow DOM

**日期：** 2026-04-05
**决策：** hover 按钮和快速添加菜单用 Shadow DOM 封装。
**理由：** 防止注入的 CSS 和 AO3 页面互相污染。Tag 高亮 / 弱化样式用 `data-*` 属性 + 高优先级选择器。

## D003 — 打包工具选 Vite + 测试用 Vitest

**日期：** 2026-04-05
**决策：** 打包用 Vite，测试用 Vitest。
**理由：** Vite 对 TypeScript 支持好、配置简单；Vitest 与 Vite 天然集成，无需额外配置。

## D004 — 采用 TDD 开发模式

**日期：** 2026-04-05
**决策：** 核心逻辑（core/ + content/ao3Parser）采用 TDD：先写测试，再写实现，测试通过即完成。
**理由：** 规则引擎、通配符匹配、优先级解析都是纯函数，输入输出明确，非常适合 test-first。同时也便于 Codex 自验证——写完跑 `npm run test` 即可确认。
**范围：** UI 层（popup / options / hoverMenu）不强制 TDD，手动测试为主。
