# MVP 范围定义

## MVP 目标

不是"尽量多做功能"，而是验证五个关键假设：

1. 用户是否真的愿意建立和维护规则
2. 四类 action 是否足够表达主要需求
3. 悬停快速操作入口是否顺手
4. 当前页即时反馈是否清晰
5. 这个产品是否值得长期装着

## 必须做

- 桌面 Chrome 扩展（Manifest V3）
- AO3 列表页 + 作品详情页 tag 识别
- 三类 tag：relationship / character / freeform
- 三种匹配方式：exact / contains / wildcard
- 四种规则 action：highlight / warn / mute / hideWork
- Tag 悬停小按钮 + 快速添加菜单
- 即时重渲染 + Toast 反馈
- Popup：当前页命中摘要 + 全局开关
- Options：规则列表 CRUD + 启停
- 本地存储（`chrome.storage.local`）

## 不做

- 移动端交互
- 云同步 / 登录 / 账号系统
- AI 推荐
- 自动翻页抓取 / 跨页批量分析
- 复杂条件表达式（与 / 或 / 非）
- 规则模板分享
- React 或其他 UI 框架
- 跨浏览器（Firefox / Safari）

## 核心用户流程

```
打开 AO3 列表页
  → 插件自动解析 tag
  → 命中规则的 tag / 作品即时变化（高亮 / 弱化 / 警示 / 折叠）
  → 用户悬停某个 tag → 出现小按钮
  → 点击 → 选择 action → 规则创建
  → 页面立即刷新效果
```

## 交互约束

- 悬停按钮只在桌面端有效（依赖 hover 事件）
- 折叠作品显示为占位条，点击可展开
- 规则变更后当前页立即重算，无需刷新
- 同一 tag 命中多条规则时，按 hideWork > warn > highlight > mute 优先级取胜
