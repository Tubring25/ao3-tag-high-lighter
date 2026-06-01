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
