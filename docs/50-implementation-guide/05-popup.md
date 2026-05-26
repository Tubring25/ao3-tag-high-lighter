# 05 — Popup 弹窗

对应 checklist：G1（命中统计）、G2（全局开关）、G3（跳转 options）

## 涉及文件

| 文件 | 职责 |
|---|---|
| `src/popup/popupApp.ts` | popup 可测试控制器 |
| `src/popup/index.ts` | popup 入口，只负责启动 app |
| `src/popup/popup.css` | popup 样式 |
| `src/content/hitStats.ts` | content 侧命中统计计算 |
| `src/shared/message.ts` | `GET_HIT_STATS` / `HitStats` 协议 |

## 当前行为

popup 每次打开时重新读取状态：

1. 读取 settings，渲染全局启停开关
2. 查询当前 active tab
3. 向当前 tab 发送 `{ type: "GET_HIT_STATS" }`
4. 成功时显示 highlight / warn / mute / hideWork / totalRules
5. 失败或非 AO3 页时显示 fallback
6. 点击 "Manage rules" 打开 options 页面

## Message Protocol

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

`GET_HIT_STATS` 只由 popup 直接发送给当前 tab 的 content script，不经过 background 广播。

## contentApp 响应

`contentApp` 缓存最近一次 `MatchResult`，收到 `GET_HIT_STATS` 时同步 `sendResponse()`：

```typescript
deps.addMessageListener((message, sendResponse) => {
  if (message.type === "GET_HIT_STATS") {
    sendResponse?.(calculateHitStats(latestMatchResult, cachedRules.length));
    return;
  }
});
```

统计逻辑与 renderer 一致：同一 tag 多规则命中时先按优先级收敛，再统计 tag 级 highlight / mute；warn / hideWork 按 work summary 统计。

## Popup Controller

```typescript
export interface PopupAppDeps {
  getSettings(): Promise<Settings>;
  saveSettings(patch: Partial<Settings>): Promise<Settings>;
  getCurrentTabId(): Promise<number | null>;
  sendMessageToTab(tabId: number, message: RuntimeMessage): Promise<unknown>;
  openOptionsPage(): void;
  logError(error: unknown): void;
}

export async function renderPopupApp(
  container: HTMLElement,
  deps?: PopupAppDeps
): Promise<void>;
```

全局开关直接调用：

```typescript
await saveSettings({ extensionEnabled: checked });
```

`saveSettings()` 已负责发送 `SETTINGS_UPDATED`，由 background 广播到 AO3 tabs。

## 当前不做

- 不实现 options CRUD；按钮只打开 options 页面。
- 不在 popup 内重新 parse AO3 页面，只读取 content script 已缓存的当前页 stats。
- 不保持 popup 内部状态；popup 每次打开重新初始化。
