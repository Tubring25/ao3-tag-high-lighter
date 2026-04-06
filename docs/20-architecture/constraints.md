# 架构约束与技术决策

## 硬约束

1. **Manifest V3** — Chrome 已废弃 V2，新扩展必须用 V3。
2. **无远程代码** — MV3 禁止远程代码执行；所有逻辑必须打包在扩展内。
3. **Service Worker 非持久** — background 脚本随时可能被回收，不能依赖内存状态。
4. **AO3 DOM 结构不受控** — AO3 可能随时改版，parser 需要做好容错。

## 设计原则

1. **规则模型不依赖交互方式** — 以后从 hover 换成 tap 时，Rule 接口零改动。
2. **匹配引擎是纯函数** — 输入 `(rules, tags)` → 输出 `MatchResult`，无副作用，易于测试。
3. **样式隔离** — content script 注入的 hover 菜单用 Shadow DOM；tag 样式用 `data-*` 属性 + 高优先级选择器，不污染 AO3 原有样式。
4. **最小权限** — manifest 只申请 `storage`、`scripting`，host_permissions 仅 `archiveofourown.org`。

## MVP 阶段刻意不做的事

- 不用 React / Vue — popup 和 options 用原生 DOM 足够
- 不做复杂选择器抽象 — 先用直白的 AO3 parser，后面再重构
- 不做复杂规则表达式 — 先把 exact / contains / wildcard 做稳
- 不做跨浏览器 — 先只跑 Chrome
- 不做云同步 — `chrome.storage.local` 足够验证产品
