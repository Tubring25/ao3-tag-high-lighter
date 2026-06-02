# MVP Checklist

## 第 1 阶段：最小闭环

- [x] A1 — 插件工程搭建（MV3 + TS + Vite）
- [x] A2 — 最小权限配置
- [x] B1 — AO3 页面类型识别
- [x] B2 — 作品容器 + tag 列表解析
- [x] B3 — tag 类型区分
- [x] B4 — tag 文本标准化
- [x] C1 — 类型定义（types.ts）
- [x] C2 — exact 匹配
- [x] C3 — contains 匹配
- [x] C4 — wildcard 匹配
- [x] C5 — category 过滤
- [x] C6 — 优先级解析
- [x] C7 — disabled 规则过滤
- [x] D1 — highlight 样式
- [x] D2 — 原 tag 弱化 action 已移除（MVP 只保留 highlight / warn / hideWork）
- [x] D3 — warn 样式
- [x] D4 — hideWork 样式
- [x] D5 — 重算清理
- [x] E1 — 规则 CRUD 封装
- [x] E2 — 设置读写封装
- [x] E3 — 数据校验

## 第 2 阶段：页面交互

- [x] F1 — hover 小按钮
- [x] F2 — 快速添加菜单
- [x] F3 — 选 action → 创建规则
- [x] F4 — 即时重渲染
- [x] I1 — Toast 反馈

## 第 3 阶段：管理界面

- [x] G1 — popup 命中统计
- [x] G2 — popup 全局开关
- [x] G3 — popup → options 跳转
- [x] H1 — options 规则列表
- [x] H2 — options 搜索筛选
- [x] H3 — options 新增规则
- [x] H4 — options 编辑规则
- [x] H5 — options 删除规则
- [x] H6 — options 启停规则

## 第 4 阶段：稳定性

- [ ] I2 — 折叠占位条
- [x] I3 — MutationObserver
- [ ] I4 — 清理旧样式
- [x] I5 — 节流 / 防抖
- [x] I6 — 错误兜底

## 本轮记录

- 2026-05-30 — 已整理当前功能摘要用于 UI 设计稿输入；未变更实现范围，因此第 4 阶段状态保持不变。
- 2026-05-31 — 已在 Pencil 当前画布完成 MVP UI 设计稿：AO3 页面内 overlay、Chrome popup、options 规则管理页；本轮为设计交付，未改变 I2/I4/I6 实现状态。
- 2026-05-31 — 按 AO3 实际截图补充 block-focused Pencil 设计：搜索结果作品 block、hover quick-add、hideWork 折叠占位、详情页 metadata + preface block；不再设计 AO3 顶栏/页面外壳。
- 2026-05-31 — 记录 Pencil 工作偏好：后续 block 设计不要额外添加独立 header/说明区，避免用户后续手动拆分。
- 2026-05-31 — 按实测反馈移除 tag 弱化 action；MVP 保留 highlight / warn / hideWork，且 hideWork 不在单篇 fic 详情页执行。
- 2026-05-31 — 完成 I6 错误兜底：content 渲染链路、storage 读取、background 广播和入口日志均已增加 fallback；测试更新至 122/122。
- 2026-05-31 — 已清理 Pencil 设计中的 mute 相关内容：quick-add 菜单移除 Mute tag，搜索 block 的 mute tag 样式恢复普通 tag，popup/options/legend/旧 overlay 中的 mute 示例删除或改为 warn。
- 2026-05-31 — 新建 `quick-add-menu-ui-refactor` 分支并完成 Quick Add Menu UI 重构：菜单显示当前 tag/context，三项 action 文案收敛为 Highlight tag / Warn work / Collapse work，并补充 Escape 关闭与可访问性属性；`npm run build` / `npm run lint` / `npm run test` 通过（124/124）。本轮不改变 F2/F3 已完成状态。
- 2026-06-01 — 移除当前实现中的所有渐变背景：Quick Add Menu 与 options 背景均改为纯色；已将“后续设计/实现不得使用渐变背景”写入 AGENTS.md 和 D011；`npm run build` / `npm run lint` / `npm run test` 通过（124/124）。
- 2026-06-01 — 对齐 Pencil `Search Block Hover State`：tag hover 增加浅蓝底/蓝灰边框状态，inline `+` 改为 18px 红底白字按钮，quick-add popup 改为 tag 下方 block-local 菜单（白底黑边、三项纯文本选择）；`npm run build` / `npm run lint` / `npm run test` 通过（125/125）。
- 2026-06-01 — 调整 Search Block hover 细节：tag hover 不再增加 padding，仅保留灰色背景和非布局占用描边；quick-add `+` 未选中 80% opacity、菜单打开选中态 100% opacity，并移除选中态浅红 outline；`npm run build` / `npm run lint` / `npm run test` 通过（125/125）。
- 2026-06-01 — 完成 Pencil `Screen 2 — Extension Popup` 实现：popup 改为 390px archive-like 卡片、Header 品牌 + 全局 toggle、page status notice、三项命中统计、Manage rules primary action、hover button secondary action 和 Local only footer；`npm run build` / `npm run lint` / `npm run test` 通过（126/126）。
- 2026-06-01 — 微调 Screen 2 popup：移除整体背景色和底部 Local only/MVP meta；右上角全局开关增加 background/knob transform 过渡；hover button 控制从 secondary button 改为 `Tag hover quick-add` 说明型开关行；`npm run build` / `npm run lint` / `npm run test` 通过（126/126）。
- 2026-06-01 — 完成 Impeccable 相关 design review：确认无独立 `impeccable` skill，使用已安装的 `critique`/`frontend-design` 工作流 review Pencil `Screen 2 — Extension Popup` 与当前 popup 实现；`npm run build` / `npm run test` 通过（126/126）。
- 2026-06-01 — 确认项目内已安装 `.claude/skills/impeccable`（v3.5.0），`npx impeccable` CLI 可用（v2.3.2）；当前 blocker 是缺少 `PRODUCT.md`，正式使用前需先执行 init 流程；`npm run build` / `npm run test` 通过（126/126）。
- 2026-06-01 — 已执行 Impeccable init 流程：生成本地 `PRODUCT.md`、`DESIGN.md`、`.impeccable/design.json`、`.impeccable/live/config.json`，并写入本地 `.git/info/exclude` 防止进入 Git；`npx impeccable detect src/popup src/options src/styles --json` 返回空结果；`npm run build` / `npm run test` 通过（126/126）。
- 2026-06-02 — 重新 review 当前 popup 文件设计：使用 Impeccable critique 流程检查 `src/popup`，detector 返回空结果，设计健康分 29/40；主要问题为设置保存缺少用户反馈、右上全局开关视觉语义不足、paused/zero-match 状态层级不够清楚；`npm run build` / `npm run lint` / `npm run test` 通过（126/126）。
- 2026-06-02 — 按 popup review 结果完成 UI 与设计文件更新：全局/hover quick-add 开关增加 `Saving...` / `Saved` / 失败反馈和失败回滚，右上全局开关显示 `On` / `Paused`，notice 区分 unavailable / paused / empty / active，Collapsed works stats 增加灰底 marker；同步更新 `DESIGN.md`、`.impeccable/design.json`、popup guide 和 D013；`npm run build` / `npm run lint` / `npm run test` 通过（128/128）。
- 2026-06-02 — 同步更新 Pencil `Screen 2 — Extension Popup`：Chrome popup mock 增加全局开关 `On/Saved` 状态、移除 footer meta、将 hover 控制改为 `Tag hover quick-add` 设置行、Collapsed works 改为灰底 marker；Popup notes 同步 review 决策；Pencil layout 检查无问题；`npm run build` / `npm run test` 通过（128/128）。
- 2026-06-02 — 根据反馈移除 popup/Pencil 中的 `Saved` 成功提示，保存成功后清空反馈，仅保留 `Saving...` 和失败文案；全局约束更新为 hover/focus 不使用组件外 outline，改用颜色深浅/透明度区分状态；同步调整 popup、hover menu、AGENTS.md、DESIGN.md、Pencil 和 D014；`npm run build` / `npm run lint` / `npm run test` 通过（128/128）。
