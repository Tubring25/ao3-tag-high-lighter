# 05 — Popup 弹窗

对应 checklist：G1（命中统计）、G2（全局开关）、G3（跳转 options）

## 涉及文件

| 文件 | 职责 |
|---|---|
| `popup.html` | popup HTML 入口，build 后输出为 `dist/popup.html` |
| `src/popup/index.ts` | popup 逻辑 |
| `src/popup/popup.css` | popup 样式 |
| `src/storage/settingsStorage.ts` | 读写全局开关 |

## 功能描述

popup 是用户点击浏览器工具栏扩展图标时弹出的小窗口，功能极简：

1. 显示当前标签页的命中统计（各 action 数量）
2. 全局启停开关
3. 跳转到 options 页面

## UI 布局

```
┌─────────────────────────────┐
│  AO3 Tag Highlighter        │
│                             │
│  ┌──────────────────────┐   │
│  │  全局开关     [ON]   │   │
│  └──────────────────────┘   │
│                             │
│  当前页命中                  │
│  ┌──────────────────────┐   │
│  │ 🌟 高亮    12 tags   │   │
│  │ ⚠️ 警告     3 works  │   │
│  │ 👻 弱化     8 tags   │   │
│  │ 🙈 折叠     2 works  │   │
│  └──────────────────────┘   │
│                             │
│  [ ⚙ 管理规则 ]            │
│                             │
└─────────────────────────────┘
```

## 实现方案

### popup.html

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AO3 Tag Highlighter</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./src/popup/index.ts"></script>
  </body>
</html>
```

### index.ts 逻辑

#### 1. 获取当前标签页的命中数据

popup 本身无法直接访问 content script 的内存数据。需要通过 message 通信获取：

```typescript
// popup 向 content script 发消息请求命中数据
async function getHitStats(): Promise<HitStats | null> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return null;

    const response = await chrome.tabs.sendMessage(tab.id, { type: "GET_HIT_STATS" });
    return response as HitStats;
  } catch {
    return null; // 非 AO3 页面或 content script 未加载
  }
}
```

**HitStats 类型**（在 `src/shared/message.ts` 中添加）：

```typescript
export interface HitStats {
  highlight: number;
  warn: number;
  mute: number;
  hideWork: number;
  totalRules: number;
}
```

**content script 侧响应**（在 `content/index.ts` 中添加 listener）：

```typescript
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GET_HIT_STATS") {
    sendResponse(computeHitStats());
    return true; // 保持消息通道开放（异步响应时需要）
  }
});

function computeHitStats(): HitStats {
  const result = matchRules(cachedWorks, cachedRules);
  const stats: HitStats = {
    highlight: 0, warn: 0, mute: 0, hideWork: 0,
    totalRules: cachedRules.length,
  };

  for (const match of result.tagMatches) {
    if (match.action === "highlight") stats.highlight++;
    else if (match.action === "mute") stats.mute++;
  }

  for (const summary of result.workSummaries) {
    if (summary.hasWarn) stats.warn++;
    if (summary.hasHideWork) stats.hideWork++;
  }

  return stats;
}
```

需要在 `src/shared/message.ts` 中扩展 RuntimeMessage 类型：

```typescript
export type RuntimeMessage =
  | { type: "RULES_UPDATED" }
  | { type: "SETTINGS_UPDATED" }
  | { type: "GET_HIT_STATS" };
```

#### 2. 全局开关

```typescript
import { getSettings, saveSettings } from "../storage/settingsStorage";

async function renderToggle(container: HTMLElement): Promise<void> {
  const settings = await getSettings();

  const wrapper = document.createElement("div");
  wrapper.className = "popup-toggle";

  const label = document.createElement("span");
  label.textContent = "全局开关";

  const toggle = document.createElement("input");
  toggle.type = "checkbox";
  toggle.checked = settings.extensionEnabled;
  toggle.addEventListener("change", async () => {
    await saveSettings({ extensionEnabled: toggle.checked });
    // 通知 content script 设置已更新
    // sendMessage 会通过 background 中转给 content script
  });

  wrapper.appendChild(label);
  wrapper.appendChild(toggle);
  container.appendChild(wrapper);
}
```

**全局开关的通知机制：**

`saveSettings` 内部已经会发送 `SETTINGS_UPDATED` 消息。但 popup 发的 `runtime.sendMessage` 只会被 background 收到，不会被 content script 收到。需要 background 中转（见 `07-background.md`），或者 popup 直接用 `chrome.tabs.sendMessage` 发给当前 tab：

```typescript
async function notifyContentScript(): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, { type: "SETTINGS_UPDATED" });
    }
  } catch {
    // 忽略
  }
}
```

#### 3. 跳转到 options

```typescript
function renderOptionsLink(container: HTMLElement): void {
  const link = document.createElement("button");
  link.className = "popup-options-link";
  link.textContent = "⚙ 管理规则";
  link.addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
  container.appendChild(link);
}
```

#### 4. 渲染命中统计

```typescript
async function renderStats(container: HTMLElement): Promise<void> {
  const stats = await getHitStats();

  const section = document.createElement("div");
  section.className = "popup-stats";

  if (!stats) {
    section.textContent = "当前页面不是 AO3，或插件未加载。";
    container.appendChild(section);
    return;
  }

  const items = [
    { emoji: "🌟", label: "高亮", count: stats.highlight, unit: "tags" },
    { emoji: "⚠️", label: "警告", count: stats.warn, unit: "works" },
    { emoji: "👻", label: "弱化", count: stats.mute, unit: "tags" },
    { emoji: "🙈", label: "折叠", count: stats.hideWork, unit: "works" },
  ];

  for (const item of items) {
    const row = document.createElement("div");
    row.className = "popup-stat-row";
    row.textContent = `${item.emoji} ${item.label}  ${item.count} ${item.unit}`;
    section.appendChild(row);
  }

  container.appendChild(section);
}
```

#### 5. 组装入口

```typescript
import "./popup.css";

async function main(): Promise<void> {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) return;

  app.innerHTML = "";

  const title = document.createElement("h1");
  title.className = "popup-title";
  title.textContent = "AO3 Tag Highlighter";
  app.appendChild(title);

  await renderToggle(app);
  await renderStats(app);
  renderOptionsLink(app);
}

main().catch(console.error);
```

### popup.css 样式参考

```css
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  color: #333;
}

#app {
  min-width: 280px;
  padding: 16px;
}

.popup-title {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 600;
}

.popup-toggle {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #f5f5f5;
  border-radius: 6px;
  margin-bottom: 12px;
}

.popup-stats {
  margin-bottom: 12px;
}

.popup-stat-row {
  padding: 6px 0;
  font-size: 13px;
  border-bottom: 1px solid #eee;
}

.popup-stat-row:last-child {
  border-bottom: none;
}

.popup-options-link {
  display: block;
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  text-align: center;
  font-size: 14px;
  color: #555;
}

.popup-options-link:hover {
  background: #f0f0f0;
}
```

## 注意事项

- popup 每次打开都会重新初始化，不存在"状态保持"的问题。
- `chrome.runtime.openOptionsPage()` 会打开 manifest 中声明的 `options_page`。
- popup 的宽度有限（Chrome 限制 max 800px，一般建议 280–400px）。
- popup 中使用 `chrome.tabs.sendMessage` 时，需要确保目标 tab 有 content script 在监听。如果用户在非 AO3 页面打开 popup，通信会失败，需要 try/catch 兜底。
- 开关的视觉可以用原生 checkbox，也可以用自定义的 toggle switch。MVP 阶段用原生 checkbox 即可，后续可以美化。

## 可选增强

- 用一个漂亮的 toggle switch 替代原生 checkbox（纯 CSS 实现）
- 无命中时显示"暂无命中规则"文案
- 显示当前规则总数（`共 ${stats.totalRules} 条规则`）
