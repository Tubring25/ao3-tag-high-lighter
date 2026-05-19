# 04 — 悬停按钮 + 快速添加菜单

对应 checklist：F1（hover 小按钮）、F2（快速添加菜单）、F3（选 action → 创建规则）、F4（即时重渲染）

## 涉及文件

| 文件 | 职责 |
|---|---|
| `src/content/hoverMenu.ts` | 悬停按钮 + 菜单的挂载、事件绑定、DOM 创建 |
| `src/storage/ruleStorage.ts` | 创建规则时调用 `addRule()` |
| `src/styles/content.css` | 按钮和菜单的样式 |

## 设计思路

### 交互流程

```
鼠标悬停 tag
  → tag 旁边出现一个小按钮 [+]
  → 鼠标移开 tag → 按钮消失
  → 点击按钮 → 弹出菜单（4 个 action 选项）
  → 用户选择一个 action
  → 创建规则（pattern = tag 文本, matchMode = exact, category = tag 的分类）
  → 关闭菜单
  → 触发页面重渲染
  → 显示 Toast（"规则已创建"）
```

### 核心决策

1. **用 Shadow DOM 隔离样式** —— 菜单和按钮的 CSS 不能被 AO3 的样式影响，也不能影响 AO3 页面。
2. **全局只有一个按钮实例和一个菜单实例** —— 不是给每个 tag 都创建，而是共享一个浮动元素，通过定位来跟随当前 hover 的 tag。
3. **菜单定位用 `position: fixed` + 计算坐标** —— 基于 tag 的 `getBoundingClientRect()` 来放置。

## 函数签名

```typescript
import type { ParsedWork, ParsedTag, Settings } from "../core/types";

export function mountHoverMenu(
  works: readonly ParsedWork[],
  settings: Settings,
  onRuleCreated: () => void   // 回调，通知 content/index.ts 重新渲染
): void;

export function unmountHoverMenu(): void;
```

## 实现方案

### 1. 创建 Shadow DOM 宿主

```typescript
let shadowHost: HTMLElement | null = null;
let shadowRoot: ShadowRoot | null = null;

function ensureShadowHost(): ShadowRoot {
  if (shadowRoot) return shadowRoot;

  shadowHost = document.createElement("div");
  shadowHost.id = "ao3th-hover-host";
  shadowHost.style.position = "fixed";
  shadowHost.style.top = "0";
  shadowHost.style.left = "0";
  shadowHost.style.zIndex = "999999";
  shadowHost.style.pointerEvents = "none"; // 宿主不拦截事件

  shadowRoot = shadowHost.attachShadow({ mode: "open" });
  document.body.appendChild(shadowHost);
  return shadowRoot;
}
```

### 2. 创建按钮元素

```typescript
function createButton(): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className = "ao3th-hover-btn";
  btn.textContent = "+";
  btn.style.pointerEvents = "auto"; // 按钮本身可点击
  return btn;
}
```

### 3. 创建菜单元素

```typescript
interface MenuAction {
  label: string;
  action: "highlight" | "warn" | "mute" | "hideWork";
  emoji: string;
}

const MENU_ACTIONS: MenuAction[] = [
  { label: "高亮", action: "highlight", emoji: "🌟" },
  { label: "警告", action: "warn", emoji: "⚠️" },
  { label: "弱化", action: "mute", emoji: "👻" },
  { label: "折叠作品", action: "hideWork", emoji: "🙈" },
];

function createMenu(): HTMLElement {
  const menu = document.createElement("div");
  menu.className = "ao3th-hover-menu";
  menu.style.pointerEvents = "auto";

  for (const item of MENU_ACTIONS) {
    const option = document.createElement("button");
    option.className = "ao3th-menu-option";
    option.dataset.action = item.action;
    option.textContent = `${item.emoji} ${item.label}`;
    menu.appendChild(option);
  }

  return menu;
}
```

### 4. Shadow DOM 内的样式

在 Shadow DOM 内注入一段 `<style>`（不影响外部）：

```typescript
function injectShadowStyles(root: ShadowRoot): void {
  const style = document.createElement("style");
  style.textContent = `
    .ao3th-hover-btn {
      position: fixed;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: 1px solid #888;
      background: #fff;
      color: #333;
      font-size: 14px;
      line-height: 1;
      cursor: pointer;
      display: none;
      align-items: center;
      justify-content: center;
      box-shadow: 0 1px 4px rgba(0,0,0,0.2);
      z-index: 1;
    }
    .ao3th-hover-btn:hover {
      background: #eee;
    }
    .ao3th-hover-menu {
      position: fixed;
      display: none;
      flex-direction: column;
      background: #fff;
      border: 1px solid #ccc;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      padding: 4px 0;
      min-width: 140px;
      z-index: 2;
    }
    .ao3th-menu-option {
      display: block;
      width: 100%;
      padding: 8px 12px;
      border: none;
      background: none;
      text-align: left;
      font-size: 13px;
      cursor: pointer;
      color: #333;
    }
    .ao3th-menu-option:hover {
      background: #f0f0f0;
    }
  `;
  root.appendChild(style);
}
```

### 5. 事件绑定：mouseenter / mouseleave

```typescript
let currentTag: ParsedTag | null = null;
let hideTimeout: ReturnType<typeof setTimeout> | null = null;

export function mountHoverMenu(
  works: readonly ParsedWork[],
  settings: Settings,
  onRuleCreated: () => void
): void {
  if (!settings.hoverButtonEnabled) return;

  const root = ensureShadowHost();
  injectShadowStyles(root);

  const btn = createButton();
  const menu = createMenu();
  root.appendChild(btn);
  root.appendChild(menu);

  // 给每个 tag element 注册 hover 事件
  for (const work of works) {
    for (const tag of work.tags) {
      tag.element.addEventListener("mouseenter", () => {
        if (hideTimeout) clearTimeout(hideTimeout);
        currentTag = tag;
        showButton(btn, tag.element);
      });

      tag.element.addEventListener("mouseleave", () => {
        hideTimeout = setTimeout(() => {
          hideButton(btn);
          hideMenu(menu);
          currentTag = null;
        }, 200); // 延迟隐藏，给用户移向按钮的时间
      });
    }
  }

  // 按钮 hover 保持显示
  btn.addEventListener("mouseenter", () => {
    if (hideTimeout) clearTimeout(hideTimeout);
  });

  btn.addEventListener("mouseleave", () => {
    hideTimeout = setTimeout(() => {
      hideButton(btn);
      hideMenu(menu);
      currentTag = null;
    }, 200);
  });

  // 点击按钮 → 显示菜单
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (currentTag) {
      showMenu(menu, btn);
    }
  });

  // 点击菜单选项 → 创建规则
  menu.addEventListener("click", async (e) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>(".ao3th-menu-option");
    if (!target || !currentTag) return;

    const action = target.dataset.action as Rule["action"];
    await addRule({
      pattern: currentTag.text,
      action,
      matchMode: "exact",
      category: currentTag.category,
      enabled: true,
      source: "quickAdd",
    });

    hideMenu(menu);
    hideButton(btn);
    currentTag = null;
    onRuleCreated(); // 通知外部重新渲染
  });

  // 点击页面其他地方关闭菜单
  document.addEventListener("click", () => {
    hideMenu(menu);
  });
}
```

### 6. 定位函数

```typescript
function showButton(btn: HTMLButtonElement, tagEl: HTMLElement): void {
  const rect = tagEl.getBoundingClientRect();
  btn.style.display = "flex";
  btn.style.left = `${rect.right + 4}px`;   // tag 右侧 4px
  btn.style.top = `${rect.top + (rect.height - 22) / 2}px`; // 垂直居中
}

function hideButton(btn: HTMLButtonElement): void {
  btn.style.display = "none";
}

function showMenu(menu: HTMLElement, btn: HTMLButtonElement): void {
  const rect = btn.getBoundingClientRect();
  menu.style.display = "flex";
  menu.style.left = `${rect.right + 4}px`;
  menu.style.top = `${rect.top}px`;
}

function hideMenu(menu: HTMLElement): void {
  menu.style.display = "none";
}
```

### 7. unmountHoverMenu

```typescript
export function unmountHoverMenu(): void {
  shadowHost?.remove();
  shadowHost = null;
  shadowRoot = null;
  currentTag = null;
}
```

## 定位边界处理

按钮和菜单可能超出视口右侧或底部，需要边界检测：

```typescript
function clampPosition(
  left: number,
  top: number,
  width: number,
  height: number
): { left: number; top: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  return {
    left: Math.min(left, vw - width - 8),
    top: Math.min(top, vh - height - 8),
  };
}
```

在 `showMenu` 中使用：先设为 `display: flex` 获取尺寸，然后调整位置。

## 与 content/index.ts 的串联

```typescript
// content/index.ts 中：
mountHoverMenu(cachedWorks, cachedSettings, async () => {
  // 规则创建后的回调
  cachedRules = await listRules();
  runMatchAndRender();
});
```

## 注意事项

- **Shadow DOM 的事件冒泡：** Shadow DOM 内的 click 事件会 retarget 到 shadowHost，外部 document 的 click listener 接收到的 target 是 shadowHost 而不是内部元素。利用这一点，页面其他位置的点击可以关闭菜单。
- **滚动时隐藏：** 页面滚动时按钮位置会偏移（因为 fixed 定位是相对视口的，但 tag 随页面滚动）。添加一个 scroll listener 来隐藏按钮和菜单：

```typescript
window.addEventListener("scroll", () => {
  hideButton(btn);
  hideMenu(menu);
}, { passive: true });
```

- **已有规则检测：** 如果当前 tag 已经被某条规则命中，快速菜单可以显示"已有规则"提示，或者允许覆盖。MVP 阶段可以先不做这个，直接创建新规则。
- **matchMode 默认 exact：** quickAdd 创建的规则默认用 exact 匹配，用户要改为 contains / wildcard 需要去 options 页面修改。
