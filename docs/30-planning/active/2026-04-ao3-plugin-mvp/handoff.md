# Handoff — 当前状态

**最后更新：** 2026-05-25

## 已完成

- 仓库文档骨架创建
- 两份源文档（功能总结 / 开发视角）拆分到 docs/ 各目录
- AGENTS.md / CLAUDE.md 初版
- 产品文档（prd / mvp / roadmap）填充
- 架构文档（system-overview / constraints）填充
- 规划文档（backlog / milestones / checklist）填充
- 质量文档（definition-of-done / test-strategy / manual-qa）填充
- MV3 + TypeScript + Vite + Vitest 工程骨架已创建
- `manifest.json` 最小权限已配置（`storage` + AO3 host permission）
- `src/core/types.ts` 已按架构文档补齐核心数据模型
- `ruleEngine` / `priority` / `normalize` / `ao3Parser` 的红灯测试已添加
- **`src/core/normalize.ts`** — tag 文本标准化（trim + collapse whitespace + lowercase）
- **`src/core/wildcard.ts`** — 通配符 `*` 匹配（转正则）
- **`src/core/priority.ts`** — action 优先级解析（hideWork > warn > highlight > mute）
- **`src/core/ruleEngine.ts`** — 规则匹配引擎（exact / contains / wildcard + category 过滤 + disabled 跳过）
- **`src/content/ao3Parser.ts`** — AO3 页面解析（listing 页 + 单作品详情页，提取 tag 文本 / 分类 / 标准化）
- 早期核心模块测试已通过（当时为 20 个测试 / 4 个测试文件）
- 已新增 review 文档：`review-2026-04-07-claude-progress.md`
- Codex review 3 个 findings 已处理：
  - F1: ruleEngine 补充多规则冲突测试 + workSummary flags 测试；D005 决策：优先级收敛在渲染层
  - F2: ao3Parser 补充边界测试（无结构 / 无 id / 无可识别 category / 多作品 / 同类多 tag）
  - F3: AGENTS.md + project-brief.md 阶段描述更新为"初始实现进行中"
- **`src/content/renderer.ts`** — 渲染层已实现，根据 `MatchResult` 应用 tag/action 与 work 级状态
- **`src/content/workEffects.ts`** — work 级 warn / hideWork 效果已实现，hideWork 默认 collapse 并带可点击占位条
- **`src/styles/content.css`** — content script 样式已补齐并通过 manifest 注入
- renderer 测试已新增，覆盖 highlight / mute / 优先级收敛 / warn / hideWork collapse / 重算清理
- Amp 2026-05-04 review 中 F1-F5 已处理：
  - F1: 详情页 `workId` 改为从 `/works/:id` 提取真实数字 ID
  - F2/F3: ruleEngine 对 enabled rules 预处理，提前标准化 pattern 并预编译 wildcard regex
  - F4: hideWork collapse 重渲染时保留用户展开状态
  - F5: popup/options HTML 入口扁平化为 `dist/popup.html` 和 `dist/options.html`
- `docs/50-implementation-guide/` 中 manifest / content CSS / popup / options 路径说明已同步
- **`src/storage/ruleStorage.ts`** — 规则 CRUD 已实现：list/get/add/update/delete/toggle + 数据校验 + 更新通知
- **`src/storage/settingsStorage.ts`** — 设置读写已实现：默认值、partial patch、reset、数据校验 + 更新通知
- **`src/shared/constants.ts` / `src/shared/utils.ts`** — 已补充 storage key 和 `generateId()`
- storage 测试已新增，覆盖 CRUD、默认设置、校验、通知容错
- **`src/content/contentApp.ts` / `src/content/index.ts`** — content 最小闭环已实现：读取 settings/rules，解析 AO3 页面，匹配并渲染
- **`src/background/backgroundApp.ts` / `src/background/index.ts`** — background 消息中转已实现：`RULES_UPDATED` / `SETTINGS_UPDATED` 广播到 AO3 tabs
- Amp 2026-05-04 review 中 F6 已处理：content script 入口不再是 stub
- **`src/content/hoverMenu.ts`** — hover quick-add 已实现：tag hover 显示按钮，点击选择 action 后写入 quickAdd 规则
- **`src/content/toast.ts`** — Toast 反馈已实现，quick-add 成功后按 settings 显示提示
- **`src/content/contentApp.ts`** — 已接入 hover menu；quick-add 成功后刷新 rules 并即时重渲染当前页
- **`src/content/hitStats.ts` / `src/shared/message.ts`** — `GET_HIT_STATS` 协议与当前页命中统计已实现
- **`src/popup/popupApp.ts` / `src/popup/index.ts`** — popup 已实现：命中统计、全局开关、打开 options

## 当前状态

第 1 阶段核心逻辑模块（B1–B4、C2–C7）、渲染模块（D1–D5）、存储模块（E1–E3）、content 最小闭环、background 消息中转、第 2 阶段 hover quick-add（F1–F4）和 Toast（I1），以及第 3 阶段 popup（G1–G3）已全部实现并通过测试。工程基线：

- `npm run build` 通过
- `npm run lint` 通过
- `npm run test` 全部 PASS（84/84）

## 下一步

1. 实现 options UI（H1–H6）：规则列表、搜索、新增、编辑、删除、启停
2. 后续补 MutationObserver / 防抖 / 错误兜底（I3–I6）

## 先读什么

- `docs/20-architecture/system-overview.md` — 目录结构和数据模型
- `docs/30-planning/backlog.md` — 任务清单
- `docs/30-planning/active/2026-04-ao3-plugin-mvp/checklist.md` — 进度
- `src/core/types.ts` — 核心类型定义
- `src/content/renderer.ts` — 当前页面渲染入口
- `src/storage/ruleStorage.ts` / `src/storage/settingsStorage.ts` — 本地存储 API
- `src/content/contentApp.ts` — content 最小闭环控制器
- `src/background/backgroundApp.ts` — background 消息中转控制器
- `src/content/hoverMenu.ts` — hover quick-add 交互
- `src/content/toast.ts` — Toast 反馈
- `src/content/hitStats.ts` — 当前页命中统计
- `src/popup/popupApp.ts` — popup 控制器
