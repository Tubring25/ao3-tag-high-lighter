# 04 — 悬停按钮 + 快速添加菜单

对应 checklist：F1（hover 小按钮）、F2（快速添加菜单）、F3（选 action → 创建规则）、F4（即时重渲染）

## 涉及文件

| 文件 | 职责 |
|---|---|
| `src/content/hoverMenu.ts` | 悬停按钮 + 菜单的挂载、事件绑定、quick-add 规则创建 |
| `src/content/contentApp.ts` | 按 settings 挂载/卸载 hover menu，并在 quick-add 后重渲染 |
| `src/content/toast.ts` | quick-add 成功后的 Toast 反馈 |
| `src/storage/ruleStorage.ts` | `addRule()` 持久化 quick-add 规则 |

## 当前行为

交互流程：

```
鼠标悬停 tag
  → tag 旁边出现一个共享的 [+] 按钮
  → 点击按钮弹出 action 菜单
  → 用户选择 Highlight / Warn / Mute / Hide work
  → 创建 quickAdd 规则
  → contentApp 重新读取 rules 并即时重渲染当前页
  → 按 settings.showToast 显示 Toast
```

quick-add 默认规则：

```typescript
{
  pattern: tag.text,
  action,
  matchMode: "exact",
  category: tag.category,
  enabled: true,
  source: "quickAdd"
}
```

## Public API

```typescript
import type { ParsedWork, Rule, Settings } from "../core/types";

type QuickAddRuleInput = Omit<Rule, "id" | "createdAt" | "updatedAt">;

export interface HoverMenuOptions {
  addRule?: (input: QuickAddRuleInput) => Promise<Rule>;
  onRuleCreated: () => void | Promise<void>;
  showToast?: (message: string) => void;
}

export function mountHoverMenu(
  works: readonly ParsedWork[],
  settings: Settings,
  options: HoverMenuOptions
): void;

export function unmountHoverMenu(): void;
```

## 实现要点

- Shadow DOM 隔离按钮和菜单样式，避免 AO3 页面 CSS 互相污染。
- 全局复用一个 Shadow host、一个 hover button、一个 menu，而不是给每个 tag 创建 DOM。
- 每次 `mountHoverMenu()` 会先 `unmountHoverMenu()`，避免重复事件监听。
- `mouseenter` tag 时记录 `currentTag` 并定位按钮；按钮/menu 有短延迟隐藏，方便鼠标移入。
- 菜单点击后调用 `addRule()`，成功后调用 `onRuleCreated()`。
- 页面滚动或点击外部时隐藏按钮和菜单。

## contentApp 串联

`contentApp` 根据 settings 控制挂载：

```typescript
function syncHoverMenu(): void {
  if (!cachedSettings?.extensionEnabled || !cachedSettings.hoverButtonEnabled || cachedWorks.length === 0) {
    unmountHoverMenu();
    return;
  }

  mountHoverMenu(cachedWorks, cachedSettings, {
    onRuleCreated: async () => {
      cachedRules = await listRules();
      runMatchAndRender();
    },
  });
}
```

## 当前不做

- 不检测重复规则，MVP 允许重复 quick-add；后续可在 options 管理。
- 不在菜单里显示命中原因或已有规则详情。
- 不实现移动端 tap / long press。
- 不做 MutationObserver 下的新 tag 自动挂载；这留给稳定性阶段。
