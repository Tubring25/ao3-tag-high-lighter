# 03 — Content Script 入口串联

对应文件：`src/content/index.ts`

## 职责

`content/index.ts` 是注入 AO3 页面的入口文件，负责：

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
  ├── storage/settingsStorage.ts  → getSettings()
  ├── storage/ruleStorage.ts      → listRules()
  ├── content/ao3Parser.ts        → parseAo3Works()
  ├── core/ruleEngine.ts          → matchRules()
  ├── content/renderer.ts         → renderMatches(), clearAllRendering()
  ├── content/hoverMenu.ts        → mountHoverMenu()     [阶段 2]
  └── content/pageObserver.ts     → startPageObserver()   [阶段 4]
```

## 实现方案

### 主流程

```typescript
import { getSettings } from "../storage/settingsStorage";
import { listRules } from "../storage/ruleStorage";
import { parseAo3Works } from "./ao3Parser";
import { matchRules } from "../core/ruleEngine";
import { renderMatches, clearAllRendering } from "./renderer";
import type { ParsedWork, Settings, Rule } from "../core/types";

let cachedWorks: ParsedWork[] = [];
let cachedRules: Rule[] = [];
let cachedSettings: Settings | null = null;

async function main(): Promise<void> {
  // 1. 读取设置
  cachedSettings = await getSettings();
  if (!cachedSettings.extensionEnabled) return;

  // 2. 读取规则
  cachedRules = await listRules();
  if (cachedRules.length === 0) return; // 没有规则就不渲染

  // 3. 解析页面
  cachedWorks = parseAo3Works(document);

  // 4. 匹配 + 渲染
  runMatchAndRender();

  // 5. 挂载 hover（阶段 2 再实现）
  // mountHoverMenu(cachedWorks, cachedSettings);

  // 6. 启动 observer（阶段 4 再实现）
  // startPageObserver(onDomChange);

  // 7. 监听消息
  chrome.runtime.onMessage.addListener(onMessage);
}

function runMatchAndRender(): void {
  if (!cachedSettings?.extensionEnabled) {
    clearAllRendering(cachedWorks);
    return;
  }

  const result = matchRules(cachedWorks, cachedRules);
  renderMatches(cachedWorks, result);
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
  // 如果页面还没解析过（比如之前因为没规则而跳过），重新解析
  if (cachedWorks.length === 0) {
    cachedWorks = parseAo3Works(document);
  }
  runMatchAndRender();
}

async function handleSettingsUpdated(): Promise<void> {
  cachedSettings = await getSettings();
  if (!cachedSettings.extensionEnabled) {
    clearAllRendering(cachedWorks);
    return;
  }
  runMatchAndRender();
}
```

### 入口调用

```typescript
main().catch((err) => {
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

## 阶段 1 最小实现

阶段 1 不需要 hover 和 observer，最小版本只需要：

```typescript
import "../styles/content.css"; // 如果用方式 C
import { getSettings } from "../storage/settingsStorage";
import { listRules } from "../storage/ruleStorage";
import { parseAo3Works } from "./ao3Parser";
import { matchRules } from "../core/ruleEngine";
import { renderMatches } from "./renderer";

async function main(): Promise<void> {
  const settings = await getSettings();
  if (!settings.extensionEnabled) return;

  const rules = await listRules();
  if (rules.length === 0) return;

  const works = parseAo3Works(document);
  const result = matchRules(works, rules);
  renderMatches(works, result);
}

main().catch(console.error);
```

如果阶段 1 还没实现 storage，可以先硬编码测试规则：

```typescript
import type { Rule } from "../core/types";

const TEST_RULES: Rule[] = [
  {
    id: "test-1",
    pattern: "Fluff",
    action: "highlight",
    matchMode: "contains",
    category: "freeform",
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "test-2",
    pattern: "Major Character Death",
    action: "warn",
    matchMode: "exact",
    category: "freeform",
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];
```

## 调试技巧

1. 在 Chrome DevTools Console 中检查：
   - `document.querySelectorAll('.ao3th-highlight')` 看高亮的 tag 数量
   - `document.querySelectorAll('.ao3th-work-warn')` 看警告的作品数量
2. 在 `chrome://extensions` 页面点击 service worker 的"Inspect"链接可以看到 background 的 console
3. Content script 的 console.log 会出现在 AO3 页面的 DevTools Console 中
