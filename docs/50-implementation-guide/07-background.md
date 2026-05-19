# 07 — Background Service Worker

对应文件：`src/background/index.ts`

## 职责

MV3 的 service worker 是扩展的"中枢"，负责：

1. **消息中转** — popup / options 发来的消息转发给所有 AO3 tab 的 content script
2. **生命周期管理** — MV3 service worker 会被 Chrome 自动休眠和唤醒
3. **扩展安装/更新事件** — 可选地做初始化

## 当前骨架

```typescript
console.info("AO3 Tag Highlighter background worker loaded.");
```

## 实现方案

### 1. 消息中转

这是 background 最核心的功能。popup / options 通过 `chrome.runtime.sendMessage` 发消息，background 收到后转发给所有 AO3 tab：

```typescript
import type { RuntimeMessage } from "../shared/message";

chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, sender, sendResponse) => {
    // 只处理从扩展内部页面发来的消息（popup / options）
    // content script 发来的消息 sender.tab 不为 undefined
    // popup / options 发来的消息 sender.tab 为 undefined

    if (message.type === "RULES_UPDATED" || message.type === "SETTINGS_UPDATED") {
      broadcastToAo3Tabs(message);
      sendResponse({ ok: true });
    }

    return true; // 保持消息通道开放
  }
);
```

### 2. 广播到所有 AO3 Tab

```typescript
async function broadcastToAo3Tabs(message: RuntimeMessage): Promise<void> {
  const tabs = await chrome.tabs.query({
    url: "https://archiveofourown.org/*",
  });

  for (const tab of tabs) {
    if (tab.id == null) continue;
    try {
      await chrome.tabs.sendMessage(tab.id, message);
    } catch {
      // tab 可能没有 content script（例如 AO3 的登录页等非作品页面）
    }
  }
}
```

**关键点：**
- 使用 `chrome.tabs.query` 查找所有 AO3 域名的 tab
- 逐个用 `chrome.tabs.sendMessage` 发送
- 某个 tab 没有 content script 时会报错，用 try/catch 忽略

### 3. 安装事件（可选）

```typescript
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.info("[AO3 Tag Highlighter] Extension installed.");
    // 可选：打开 options 页面引导用户
    // chrome.runtime.openOptionsPage();
  }

  if (details.reason === "update") {
    console.info(`[AO3 Tag Highlighter] Updated to v${chrome.runtime.getManifest().version}`);
  }
});
```

### 4. 完整代码

```typescript
import type { RuntimeMessage } from "../shared/message";

console.info("AO3 Tag Highlighter background worker loaded.");

chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, _sender, sendResponse) => {
    if (message.type === "RULES_UPDATED" || message.type === "SETTINGS_UPDATED") {
      broadcastToAo3Tabs(message);
      sendResponse({ ok: true });
    }
    return true;
  }
);

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.info("[AO3 Tag Highlighter] Extension installed.");
  }
});

async function broadcastToAo3Tabs(message: RuntimeMessage): Promise<void> {
  const tabs = await chrome.tabs.query({
    url: "https://archiveofourown.org/*",
  });

  for (const tab of tabs) {
    if (tab.id == null) continue;
    try {
      await chrome.tabs.sendMessage(tab.id, message);
    } catch {
      // 忽略没有 content script 的 tab
    }
  }
}
```

## 消息流向图

```
popup / options
  ──[chrome.runtime.sendMessage]──→ background (service worker)
                                      │
                                      ├──[chrome.tabs.sendMessage]──→ AO3 Tab 1 (content script)
                                      ├──[chrome.tabs.sendMessage]──→ AO3 Tab 2 (content script)
                                      └──[chrome.tabs.sendMessage]──→ AO3 Tab N (content script)

content script
  ──[chrome.runtime.onMessage.addListener]──→ 监听并响应
```

**特殊情况：popup 直接发给当前 tab**

popup 也可以跳过 background，直接用 `chrome.tabs.sendMessage(tabId, msg)` 发给当前 tab。适合只需要更新当前页面的场景（比如全局开关切换后只需要当前 tab 立即响应）。

但如果用户在 options 页面修改规则，需要所有 AO3 tab 都更新，就必须通过 background 广播。

**建议：统一走 background 中转**，逻辑更一致，不容易漏。

## MV3 Service Worker 注意事项

1. **自动休眠**：MV3 service worker 在空闲 30 秒后会被 Chrome 终止。下次收到消息或事件时自动唤醒。所以不要在 service worker 中保存状态到变量中，每次都从 storage 读取。
2. **没有 DOM**：service worker 中没有 `document`、`window` 等 DOM API。
3. **`chrome.tabs.query` 需要权限**：`manifest.json` 中已有 `host_permissions: ["https://archiveofourown.org/*"]`，这足以使用 `chrome.tabs.query` 查询 AO3 的 tab。不需要额外的 `tabs` 权限。
4. **sendMessage 时机**：如果 content script 还没加载完（页面正在加载中），`chrome.tabs.sendMessage` 会失败。try/catch 即可。

## message.ts 更新

`src/shared/message.ts` 需要补充完整的消息类型：

```typescript
export type RuntimeMessage =
  | { type: "RULES_UPDATED" }
  | { type: "SETTINGS_UPDATED" }
  | { type: "GET_HIT_STATS" };

export interface HitStats {
  highlight: number;
  warn: number;
  mute: number;
  hideWork: number;
  totalRules: number;
}
```

## 测试

background service worker 的测试比较困难（需要 Chrome Extension 运行环境），建议手动测试：

1. 打开 `chrome://extensions`，找到扩展，点击 "service worker" 链接打开 DevTools
2. 在 Console 中检查 `console.info` 输出
3. 在 options 页面修改规则，观察 background Console 中是否有消息日志
4. 同时打开两个 AO3 tab，修改规则后两个 tab 是否都更新
