# 决策记录

## D001 — UI 不用框架

**日期：** 2026-04-05
**决策：** MVP 阶段 popup / options / 页面内菜单全部用 vanilla DOM + CSS，不引入 React / Vue。
**理由：** 页面量小、交互简单，引入框架增加打包体积和复杂度，收益不大。

## D002 — Content script 悬停菜单用 Shadow DOM

**日期：** 2026-04-05
**决策：** hover 按钮和快速添加菜单用 Shadow DOM 封装。
**理由：** 防止注入的 CSS 和 AO3 页面互相污染。Tag 高亮 / 警示样式用 `data-*` 属性 + 高优先级选择器。

## D003 — 打包工具选 Vite + 测试用 Vitest

**日期：** 2026-04-05
**决策：** 打包用 Vite，测试用 Vitest。
**理由：** Vite 对 TypeScript 支持好、配置简单；Vitest 与 Vite 天然集成，无需额外配置。

## D004 — 采用 TDD 开发模式

**日期：** 2026-04-05
**决策：** 核心逻辑（core/ + content/ao3Parser）采用 TDD：先写测试，再写实现，测试通过即完成。
**理由：** 规则引擎、通配符匹配、优先级解析都是纯函数，输入输出明确，非常适合 test-first。同时也便于 Codex 自验证——写完跑 `npm run test` 即可确认。
**范围：** UI 层（popup / options / hoverMenu）不强制 TDD，手动测试为主。

## D005 — 优先级收敛在渲染层而非匹配层

**日期：** 2026-04-07
**决策：** `matchRules()` 返回所有命中记录（同一 tag 可出现多条 match），优先级收敛由 renderer 在消费 `tagMatches` 时调用 `resolveHighestPriorityAction()` 完成。
**理由：**
- renderer 需要完整的命中信息来展示"被哪些规则命中"（如 tooltip / popup 统计）。
- 架构约束 #2 "匹配引擎 ↔ 渲染层分离"要求 match 阶段是纯检测，不含渲染决策。
- `WorkMatchSummary.hasWarn / hasHideWork` 已在 engine 侧提供 work 级快速判断，够用。

## D006 — Popup / Options HTML 使用根目录构建入口

**日期：** 2026-05-11
**决策：** `popup.html` 和 `options.html` 放在仓库根目录作为 Vite HTML 入口，页面逻辑和样式仍放在 `src/popup/`、`src/options/`。
**理由：** Chrome extension manifest 的 popup/options 路径相对 `dist/` 根目录。根目录 HTML 入口会稳定输出为 `dist/popup.html` 和 `dist/options.html`，避免 manifest 暴露源码目录结构或引用构建后不存在的路径。

## D007 — UI 视觉方向采用 AO3-adjacent 克制增强

**日期：** 2026-05-31
**决策：** MVP UI 设计稿采用 AO3-adjacent 风格：off-white archive 背景、高对比文字、克制 AO3 red 强调、方角/低圆角、低装饰；插件 UI 以「增强原页面」为目标，不做强品牌化或重视觉覆盖。
**理由：** AO3 Tag Highlighter 的核心价值是降低 tag 扫读成本，不应夺走 AO3 原站的阅读节奏。参考 Fanhackers 对 AO3 设计价值的总结，界面应优先体现用户自主、可解释状态、本地控制与低干扰。

## D008 — MVP 移除 tag 弱化 action

**日期：** 2026-05-31
**决策：** MVP 规则 action 收敛为 `highlight` / `warn` / `hideWork`，不再提供 tag 弱化效果。
**理由：** 实测该效果感知价值低，且会增加 options、popup 统计、hover 菜单和优先级逻辑的复杂度。保留高亮、警告和折叠 fic 三个高价值动作即可覆盖当前核心场景。

## D009 — 作品详情页不执行 hideWork

**日期：** 2026-05-31
**决策：** `hideWork` 只作用于列表页作品卡片；单篇作品详情页不折叠/隐藏当前 fic，也不让 hideWork 覆盖详情页 tag 的高亮/警告优先级。
**理由：** 用户进入详情页后隐藏整篇 fic 的收益很低，反而容易造成页面突然消失的困惑。详情页仍保留 tag 高亮与 warn 提示，帮助用户识别命中原因。

## D010 — Quick Add Menu 显示 tag context 与可解释 action 文案

**日期：** 2026-05-31
**决策：** 页面内 quick-add 交互对齐 Pencil `Search Block Hover State`：hover tag 使用浅蓝灰背景但不增加 padding，inline `+` 使用 18px 红底白字按钮并以 opacity 区分未选中/选中（80%/100%），popup 使用 tag 下方白底黑边 block-local 菜单；`hideWork` 在 UI 文案中表达为 `Collapse work`，但底层 action 值保持 `hideWork` 不变。
**理由：** 用户点击悬停按钮后需要确认即将创建规则的 tag，并理解 action 影响范围（tag vs work）。对齐 block-local 设计可减少遮挡并更贴近 AO3 搜索结果 block 语境，同时避免改动规则模型和存储结构。

## D011 — UI 禁用渐变背景

**日期：** 2026-06-01
**决策：** 后续所有 UI 设计稿和代码实现都不使用渐变背景（包括 `linear-gradient`、`radial-gradient`、`conic-gradient`）。需要层次时优先使用纯色填充、边框、阴影、留白、字号和字重。
**理由：** 当前产品视觉方向是 AO3-adjacent、克制、低干扰；渐变背景会增加装饰感并降低与 AO3 原站的融合度。统一禁用可减少后续返工。
