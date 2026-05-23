# 03 — Content Script 入口串联

对应文件：`src/content/index.ts`、`src/content/contentApp.ts`

## 职责

`content/index.ts` 是注入 AO3 页面的入口文件，只负责导入 CSS 并启动 `contentApp`。`contentApp.ts` 负责：

1. 读取 settings，判断是否启用
2. 读取规则
3. 调用 parser 解析页面
4. 调用 ruleEngine 匹配
5. 调用 renderer 渲染
6. 挂载 hover 交互
7. 监听消息，响应规则/设置变更后重新渲染

## 依赖关系

```
content/index.ts
  ├── content/contentApp.ts       → startContentApp()

content/contentApp.ts
  ├── storage/settingsStorage.ts  → getSettings()
  ├── storage/ruleStorage.ts      → listRules()
  ├── content/ao3Parser.ts        → parseAo3Works()
  ├── core/ruleEngine.ts          → matchRules()
  ├── content/renderer.ts         → renderMatches(), clearRenderedMatches()
  ├── content/hoverMenu.ts        → mountHoverMenu()     [阶段 2]
  └── content/pageObserver.ts     → startPageObserver()   [阶段 4]
```

## 实现方案

### 当前实现结构

`contentApp.ts` 使用依赖注入，测试中可替换 storage / parser / renderer / message listener：

```typescript
export async function startContentApp(deps = realDeps): Promise<void> {
  // 先注册 listener，再做任何 early return，确保 disabled/no-rules 页面后续仍能响应更新。
  deps.addMessageListener(onMessage);

  cachedSettings = await deps.getSettings();
  if (!cachedSettings.extensionEnabled) return;

  cachedRules = await deps.listRules();
  cachedWorks = deps.parseAo3Works(deps.root);
  runMatchAndRender();
}

function runMatchAndRender(): void {
  if (!cachedSettings?.extensionEnabled) {
    clearRenderedMatches(cachedWorks);
    return;
  }

  if (cachedWorks.length === 0) return;
  if (cachedRules.length === 0) {
    clearRenderedMatches(cachedWorks);
    return;
  }

  const result = matchRules(cachedWorks, cachedRules);
  renderMatches(cachedWorks, result, { hideWorkMode: cachedSettings.hideWorkMode });
}
```

### 消息监听

当 popup/options 修改了规则或设置后，通过 `chrome.runtime.sendMessage` 广播变更。content script 需要监听并响应：

```typescript
import type { RuntimeMessage } from "../shared/message";

function onMessage(message: RuntimeMessage): void {
  switch (message.type) {
    case "RULES_UPDATED":
      handleRulesUpdated();
      break;
    case "SETTINGS_UPDATED":
      handleSettingsUpdated();
      break;
  }
}

async function handleRulesUpdated(): Promise<void> {
  cachedRules = await listRules();
  if (!cachedSettings?.extensionEnabled) return;

  if (cachedWorks.length === 0) {
    cachedWorks = parseAo3Works(document);
  }
  runMatchAndRender();
}

async function handleSettingsUpdated(): Promise<void> {
  cachedSettings = await getSettings();
  if (!cachedSettings.extensionEnabled) {
    clearRenderedMatches(cachedWorks);
    return;
  }

  cachedRules = await listRules();
  if (cachedWorks.length === 0) {
    cachedWorks = parseAo3Works(document);
  }
  runMatchAndRender();
}
```

关键点：

- listener 必须先注册，再根据 settings/rules early return。
- `SETTINGS_UPDATED` 从关闭切回开启时，需要重新读取 rules；若之前未解析页面，还要重新 parse。
- rules 为空时应清理旧渲染，避免删除最后一条规则后页面仍残留样式。
- message handler 内部捕获 async 错误并记录日志，不能影响 AO3 页面。

### 入口调用

```typescript
import "../styles/content.css";
import { startContentApp } from "./contentApp";

startContentApp().catch((err) => {
  console.error("[AO3 Tag Highlighter] Init error:", err);
});
```

## CSS 注入

content script 需要同时注入 CSS。在 `manifest.json` 的 `content_scripts` 中加 css 字段：

```json
"content_scripts": [
  {
    "matches": ["https://archiveofourown.org/*"],
    "js": ["content/index.js"],
    "css": ["assets/content.css"]
  }
]
```

**注意：** content.css 是通过 `src/styles/content.css` 提供的，但 Vite 默认只打包被 JS import 的 CSS。需要确保 content/index.ts 中 import 了它：

```typescript
import "../styles/content.css";
```

Vite 会把 import 的 CSS 提取为 `dist/assets/content.css`，Chrome Extension content script 再通过 manifest 的 `content_scripts.css` 声明注入。具体构建配置见 `10-manifest-build.md`。

## 模块级缓存的设计考量

- `cachedWorks`：解析结果包含 DOM element 引用，解析一次就够了。页面动态变化时由 pageObserver 触发重解析（阶段 4）。
- `cachedRules`：内存中缓存一份，规则变更时通过消息通知来刷新。
- `cachedSettings`：同上。

这样每次消息到来只需要重新匹配 + 渲染，不需要每次都重新读 storage + 重新解析 DOM。

## 阶段 1 当前完成范围

阶段 1 已接入真实 storage，不再使用硬编码测试规则。当前 content 最小闭环完成：

1. 初始化先注册 runtime message listener
2. 读取 settings，关闭时不解析不渲染
3. 启用时读取 rules 并解析 AO3 页面
4. 有规则时匹配并调用 renderer
5. rules 为空时清理旧渲染
6. 收到 `RULES_UPDATED` / `SETTINGS_UPDATED` 后重新读取数据并重渲染

## 调试技巧

1. 在 Chrome DevTools Console 中检查：
   - `document.querySelectorAll('.ao3th-highlight')` 看高亮的 tag 数量
   - `document.querySelectorAll('.ao3th-work-warn')` 看警告的作品数量
2. 在 `chrome://extensions` 页面点击 service worker 的"Inspect"链接可以看到 background 的 console
3. Content script 的 console.log 会出现在 AO3 页面的 DevTools Console 中
