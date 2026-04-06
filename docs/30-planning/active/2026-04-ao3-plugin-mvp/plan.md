# 实施计划

## 开发顺序

### 第 1 阶段：跑通最小闭环

- 建立插件工程（Manifest V3 + TypeScript + Vite）
- content script 注入 AO3 页面
- ao3Parser 解析 tag
- 规则引擎实现（exact / contains / wildcard + 优先级）
- 渲染层（highlight / mute / warn / hideWork）
- 本地 storage 写死几条测试规则

**完成标志：** 不用任何 UI，打开 AO3 页面就能看到规则效果。

### 第 2 阶段：页面内交互

- hover 小按钮
- 快速添加菜单
- quick add → 创建规则 → 即时重渲染
- Toast 反馈

**完成标志：** 用户不进设置页，也能从页面直接建立规则。

### 第 3 阶段：管理界面

- popup 当前页统计 + 全局开关
- options 规则列表 CRUD + 搜索 + 启停

**完成标志：** 已有规则可以完整维护。

### 第 4 阶段：补稳定性

- MutationObserver
- 节流 / 防抖
- 错误兜底
- 折叠占位条完善

**完成标志：** 可以给真实用户装起来用。

## 先写哪三个文件

1. `src/core/types.ts` — 所有数据模型
2. `src/content/ao3Parser.ts` — 验证能否稳定从 AO3 页面提取 tag
3. `src/core/ruleEngine.ts` — 规则匹配 + 结果聚合

这三件事跑通，后面的 hover、popup、options 都只是往上搭。
