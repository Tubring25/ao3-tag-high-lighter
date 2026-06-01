# Handoff — 当前状态

**最后更新：** 2026-06-01

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
- **`src/core/priority.ts`** — action 优先级解析（hideWork > warn > highlight）
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
- renderer 测试已新增，覆盖 highlight / 优先级收敛 / warn / hideWork collapse / 重算清理
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
- **`src/options/optionsApp.ts` / `src/options/index.ts`** — options 规则管理已实现：列表、搜索/筛选、新增、编辑、删除、启停
- **`src/content/pageObserver.ts` / `src/shared/utils.ts`** — MutationObserver 与 debounce 已实现；AO3 DOM 变化后自动防抖重算
- MVP action 已收敛为 `highlight` / `warn` / `hideWork`；tag 弱化效果已从类型、hover 菜单、popup 统计、options 表单、storage 校验和 CSS 中移除
- `hideWork` 不在单篇作品详情页执行；详情页仍保留 tag highlight / warn，且 hideWork 不再覆盖详情页 tag 的可见高亮优先级
- **I6 错误兜底** 已完成：content parser/match/render、storage 读失败、background query 失败、hover 菜单异步错误和入口日志均有兜底

## 当前状态

第 1 阶段核心闭环、第 2 阶段页面交互、第 3 阶段管理界面（popup G1–G3、options H1–H6），以及第 4 阶段 I3/I5 稳定性补强已实现并通过测试。工程基线：

- `npm run build` 通过
- `npm run lint` 通过
- `npm run test` 全部 PASS（125/125）

## 2026-05-30 补充

- 已整理当前项目功能摘要，供后续用 ChatGPT 生成 popup / options / AO3 页面内交互 UI 设计稿。
- 本轮未做代码实现变更，第 4 阶段 I2–I6 稳定性任务状态不变。
- 已复核：`npm run build` 通过，`npm run test` 全部 PASS（100/100）。

## 2026-05-31 补充

- 暂时移除 warn 命中作品左侧竖线视觉；warn 的数据状态、统计和优先级逻辑保持不变。
- 完成 I3/I5：content script 启用时启动 page observer，DOM childList 变化后 300ms 防抖重 parse/match/render，并忽略插件自身 DOM 变化。
- 移除 tag 弱化 action，只保留高亮、警告、折叠 fic；旧的无效 action 规则会在读取 storage 时被过滤。
- 补充并实现详情页限制：`hideWork` 只在列表页折叠/隐藏作品卡片，单篇 fic 详情页不执行折叠。
- 完成 I6 错误兜底：content script 内部异常只记录日志，不影响 AO3 页面；storage 读失败返回安全默认；background query/send 失败不阻断消息链路。
- 已在 Pencil 当前画布新增 `AO3 Tag Highlighter — UI Design` 设计板：
  - `Screen 1 — AO3 Page Overlay`：AO3 listing 页面内 tag 高亮、warn banner、hideWork 折叠占位条、hover quick-add 菜单。
  - `Screen 2 — Extension Popup`：当前页命中统计、全局开关、管理规则入口、本地存储提示。
  - `Screen 3 — Options Rules Manager`：规则列表、搜索/筛选、编辑侧栏、启停/删除/保存操作。
- 设计风格参考 Fanhackers「AO3 and its design values」：社区维护、用户自主、价值内嵌；视觉采用高对比文字、archive-like off-white 背景、克制 AO3 red 强调、少装饰低干扰。
- 本轮设计不改变代码实现范围，I2/I4/I6 状态保持不变。
- 根据真实 AO3 搜索页/详情页截图，新增独立 Pencil 设计板 `AO3 Article Block Designs — Search + Detail`：
  - 搜索结果作品 block：保留 AO3 2x2 rating/warning/status 图标、标题/作者、fandom、密集 tag 行、summary、右侧 stats footer。
  - 搜索结果插件状态：warn banner、highlight/warn tag、hover inline `+`、block-local quick-add menu、hideWork collapsed placeholder。
  - 详情页作品 block：metadata table、Archive Warning 命中提示、relationship/character/freeform tags、stats row、标题/作者、Summary、Notes。
  - 设计范围明确收敛为“文章 block”，不覆盖 AO3 顶栏、搜索控件、全页布局。
- Pencil 工作偏好：后续做 block 设计时只生成可直接使用/拖拽的目标 block，不要额外添加 `Block Design Header`、说明 header、legend 或外层展示型包装，除非用户明确要求。
- 已清理 Pencil 设计中的 mute 相关内容：
  - quick-add 菜单只保留 Highlight tag / Warn work / Collapse work。
  - 搜索结果 block 中原本被 mute 的 tag 改回普通 AO3 tag 样式。
  - popup 命中统计、options 示例规则、action legend、旧 overlay spec 中的 mute 示例已删除或改为 warn。

## 2026-05-31 Quick Add Menu UI 重构

- 已新建并切换到 `quick-add-menu-ui-refactor` 分支。
- `src/content/hoverMenu.ts`：重构 Shadow DOM quick-add 菜单 UI，采用 AO3-adjacent 的 off-white / muted red 视觉；菜单顶部显示当前 tag 文本与 category，action 选项改为带说明的 Highlight tag / Warn work / Collapse work。
- `src/content/hoverMenu.ts`：补充 `aria-label`、`role=menu/menuitem`、焦点样式和 Escape 关闭。
- `src/content/hoverMenu.test.ts`：更新菜单文案断言，新增 tag context 与 Escape 关闭测试。
- 已跑验证：`npm run test -- src/content/hoverMenu.test.ts` 通过（8/8）；`npm run build`、`npm run lint`、`npm run test` 全部通过（124/124）。

## 2026-06-01 渐变背景移除

- `src/content/hoverMenu.ts`：移除 Quick Add Menu hover button、focus/hover state、menu header 的渐变背景，改为纯色填充。
- `src/options/options.css`：移除 options 页面 body 的 radial/linear gradient 背景，改为纯色 archive-like 背景。
- `AGENTS.md` / `decisions.md`：新增长期约束，后续 UI 设计和实现不得使用渐变背景。
- 已跑验证：`npm run build`、`npm run lint`、`npm run test` 全部通过（124/124）。

## 2026-06-01 Search Block Hover State 对齐

- 已查看 Pencil 当前选中节点 `Search Block Hover State`：hover tag 为浅蓝底/蓝灰边框，旁边是 18px 红底白字 inline `+`；菜单为 tag 下方白底黑边 block-local popup，标题 `Add rule for “Slow Burn”`，三项纯文本选择。
- `src/content/hoverMenu.ts`：将 hover icon 调整为 18px 红底白字 `+`，菜单改为设计稿的 260px 白底黑边纯文本结构，并改为从当前 tag 下方弹出。
- `src/styles/content.css`：新增 `data-ao3th-hovered="true"` 样式，使当前 hover tag 呈现设计稿中的浅蓝底/蓝灰边框。
- `src/content/hoverMenu.test.ts`：新增 hovered tag 标记测试，并更新菜单 title/label 断言。
- 已跑验证：`npm run build`、`npm run lint`、`npm run test` 全部通过（125/125）。

## 2026-06-01 Search Block Hover State 细节修正

- `src/styles/content.css`：移除 hover tag 的 padding / inline-block / border，避免改变 AO3 tag 行布局；保留灰色背景，并用不占布局的 `box-shadow` 表达边界。
- `src/content/hoverMenu.ts`：quick-add `+` icon 默认 opacity 0.8；菜单打开时通过 `data-ao3th-active="true"` 切到 opacity 1。
- `src/content/hoverMenu.ts`：移除 icon hover/focus 的浅红 outline，不再通过 padding/border 表达选中态。
- `src/content/hoverMenu.test.ts`：补充 icon active / aria-expanded 状态断言。
- 已跑验证：`npm run build`、`npm run lint`、`npm run test` 全部通过（125/125）。

## 下一步

1. 补稳定性 I2/I4：折叠占位条增强、清理旧样式增强
2. 浏览器手动 QA：加载 `dist/`，验证 AO3 页面 quick-add、popup、options 全链路
3. 如进入 UI 实现微调：优先对照 Pencil `AO3 Article Block Designs — Search + Detail` 中的实际 block 同步 `src/styles/content.css`，再参考 popup/options 设计同步 `src/popup/popup.css`、`src/options/options.css`

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
- `src/content/pageObserver.ts` — AO3 DOM 变化监听
- `src/content/hitStats.ts` — 当前页命中统计
- `src/popup/popupApp.ts` — popup 控制器
- `src/options/optionsApp.ts` — options 规则管理控制器
