# 08 — 稳定性：Toast / Observer / 防抖 / 错误兜底

对应 checklist：I1（Toast）、I2（折叠占位条）、I3（MutationObserver）、I4（清理旧样式）、I5（节流/防抖）、I6（错误兜底）

## I1 — Toast 反馈

### 职责

规则创建 / 删除后在页面右下角显示短暂提示，2–3 秒后自动消失。

### 实现位置

当前实现位于 `src/content/toast.ts`，样式定义在 `src/styles/content.css`。

### 实现方案

```typescript
// src/content/toast.ts

export interface ToastOptions {
  durationMs?: number;
}

export function showToast(
  message: string,
  options: ToastOptions = {}
): void {
  const toast = document.createElement("div");
  toast.className = "ao3th-toast";
  toast.dataset.ao3thToast = "true";
  toast.textContent = message;

  ensureToastContainer().appendChild(toast);

  // 自动消失
  setTimeout(() => {
    toast.remove();
  }, options.durationMs ?? 2500);
}
```

### 使用场景

```typescript
// hoverMenu.ts 中规则创建后：
showToast(`规则已创建：${tag.text} → ${action}`);

// options 中规则删除后（options 页面中单独实现一份或共享）：
showToast("规则已删除");
```

**注意：** content script 和 options 页面是不同的执行环境，toast.ts 可以被两边各自 import，但不共享状态。

---

## I2 — 折叠作品占位条

已在 `01-renderer.md` 的 workEffects 部分详细说明。核心要点：

- 占位条插入到 work element 的 `afterend`（同级）
- 占位条样式在 `content.css` 中定义
- 点击占位条恢复 work 显示

### 占位条的 CSS

```css
.ao3th-collapse-placeholder {
  padding: 12px 16px;
  background: #f5f5f5;
  border: 1px dashed #ccc;
  border-radius: 4px;
  color: #888;
  font-size: 13px;
  cursor: pointer;
  margin-bottom: 1em;
  text-align: center;
  transition: background 0.2s;
}

.ao3th-collapse-placeholder:hover {
  background: #eee;
  color: #555;
}
```

### 可选增强

占位条可以显示更多信息：

```typescript
placeholder.textContent = `此作品已被折叠 —— 命中规则: ${matchedPatterns.join(", ")}（点击展开）`;
```

需要把命中的规则 pattern 传入 applyHideWork，或者在占位条的 dataset 中记录。

---

## I3 — MutationObserver

### 为什么需要

AO3 的某些页面行为会动态修改 DOM：

1. "Load More" 按钮或无限滚动加载新作品
2. 浏览器扩展的交互修改了 DOM
3. AO3 自身的 JS 动态渲染

如果不监听 DOM 变化，新加载的作品不会被规则引擎处理。

### 实现位置

`src/content/pageObserver.ts`

### 函数签名

```typescript
export function startPageObserver(
  onDomChange: () => void
): void;

export function stopPageObserver(): void;
```

### 实现方案

```typescript
let observer: MutationObserver | null = null;

export function startPageObserver(onDomChange: () => void): void {
  if (observer) return; // 防止重复注册

  const target = document.querySelector("#main") ?? document.body;

  observer = new MutationObserver((mutations) => {
    // 只关心子节点增删（新作品加载）
    const hasRelevantChange = mutations.some(
      (m) => m.type === "childList" && m.addedNodes.length > 0
    );

    if (hasRelevantChange) {
      onDomChange();
    }
  });

  observer.observe(target, {
    childList: true,
    subtree: true,
  });
}

export function stopPageObserver(): void {
  observer?.disconnect();
  observer = null;
}
```

### 与 content/index.ts 串联

```typescript
// content/index.ts 中：
startPageObserver(() => {
  // DOM 变化后重新解析 + 匹配 + 渲染
  cachedWorks = parseAo3Works(document);
  runMatchAndRender();

  // 如果有 hoverMenu，也需要重新挂载到新的 tag 上
  // unmountHoverMenu();
  // mountHoverMenu(cachedWorks, cachedSettings, onRuleCreated);
});
```

### 监听目标的选择

- `#main` 是 AO3 页面的主内容区域，大部分列表页的作品都在这里面
- 如果 `#main` 不存在（比如某些特殊页面），回退到 `document.body`
- 不要监听 `document.documentElement`，范围太大会产生大量无关事件

---

## I4 — 清理旧样式逻辑

已在 `01-renderer.md` 中详细说明。核心原则：

1. 每次 `renderMatches` 先调用 `clearRenderedMatches`
2. `clearRenderedMatches` 遍历所有 tag 移除 `ao3th-*` class
3. `clearAllWorkEffects` 遍历所有 work 移除 class + 删除占位条 + 恢复 display
4. 这样保证每次渲染都是"干净"的全量重绘

### 防止遗漏

如果 DOM 变化后重新 parse 了 works，旧的 ParsedWork 引用的 element 可能已经不在 DOM 中了。需要先用旧的 works 清理，再用新的 works 渲染：

```typescript
function onDomChange(): void {
  const oldWorks = cachedWorks;
  clearRenderedMatches(oldWorks); // 用旧引用清理

  cachedWorks = parseAo3Works(document); // 重新解析
  runMatchAndRender(); // 重新渲染
}
```

---

## I5 — 节流 / 防抖

### 为什么需要

1. MutationObserver 可能短时间内触发大量回调（比如一次 DOM 操作插入了 20 个作品节点，会触发 20 次 mutation）
2. 窗口滚动时 hoverMenu 的隐藏/显示频繁触发
3. options 搜索框的 input 事件频繁触发

### 防抖函数

在 `src/shared/utils.ts` 中添加：

```typescript
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
```

### 使用场景

#### MutationObserver 回调防抖（推荐 300ms）

```typescript
import { debounce } from "../shared/utils";

const debouncedReparse = debounce(() => {
  cachedWorks = parseAo3Works(document);
  runMatchAndRender();
}, 300);

startPageObserver(() => {
  debouncedReparse();
});
```

#### options 搜索框防抖（推荐 200ms）

```typescript
const debouncedSearch = debounce(() => {
  rerenderList();
}, 200);

searchInput.addEventListener("input", () => {
  filterText = searchInput.value.toLowerCase();
  debouncedSearch();
});
```

### 节流函数（可选）

如果需要保证一定时间内至少执行一次（比如 scroll 事件），可以加 throttle：

```typescript
export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  interval: number
): (...args: Parameters<T>) => void {
  let last = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - last >= interval) {
      last = now;
      fn(...args);
    }
  };
}
```

---

## I6 — 错误兜底

### 原则

content script 出错绝对不能影响 AO3 页面的正常交互。用户看不到插件效果是可以接受的，但页面崩溃不可接受。

### 顶层 try/catch

```typescript
// content/index.ts
async function main(): Promise<void> {
  try {
    // ... 所有初始化逻辑
  } catch (err) {
    console.error("[AO3 Tag Highlighter] Init failed:", err);
  }
}

main();
```

### 消息处理 try/catch

```typescript
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  try {
    // ... 消息处理
  } catch (err) {
    console.error("[AO3 Tag Highlighter] Message handler error:", err);
    sendResponse({ error: true });
  }
  return true;
});
```

### 渲染 try/catch

```typescript
function runMatchAndRender(): void {
  try {
    const result = matchRules(cachedWorks, cachedRules);
    renderMatches(cachedWorks, result);
  } catch (err) {
    console.error("[AO3 Tag Highlighter] Render error:", err);
  }
}
```

### Observer 回调 try/catch

```typescript
startPageObserver(() => {
  try {
    cachedWorks = parseAo3Works(document);
    runMatchAndRender();
  } catch (err) {
    console.error("[AO3 Tag Highlighter] Reparse error:", err);
  }
});
```

### storage 操作兜底

```typescript
// 读取规则失败时返回空数组，而不是崩溃
export async function listRules(): Promise<Rule[]> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY_RULES);
    const raw = result[STORAGE_KEY_RULES];
    if (!Array.isArray(raw)) return [];
    return raw;
  } catch {
    return [];
  }
}
```

### 日志前缀

所有 console 输出加统一前缀 `[AO3 Tag Highlighter]`，方便在 DevTools 中筛选：

```typescript
// src/shared/constants.ts
export const LOG_PREFIX = "[AO3 Tag Highlighter]";
```

```typescript
import { LOG_PREFIX } from "../shared/constants";

console.error(`${LOG_PREFIX} Init failed:`, err);
```

## 优先级建议

| 任务 | 优先级 | 说明 |
|---|---|---|
| I6 错误兜底 | 最高 | 应该在写每个模块时就加上，不要留到最后 |
| I1 Toast | 高 | 和 hover 菜单一起实现 |
| I4 清理旧样式 | 高 | renderer 本身就需要，已包含在 D5 |
| I3 Observer | 中 | AO3 主要页面是静态的，但有些场景需要 |
| I5 防抖 | 中 | 和 Observer 配合使用 |
| I2 折叠占位条 | 中 | hideWork 的基本体验，和 D4 一起实现 |
