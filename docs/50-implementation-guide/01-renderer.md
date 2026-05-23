# 01 — 页面渲染：renderer.ts + workEffects.ts

对应 checklist：D1（highlight）、D2（mute）、D3（warn）、D4（hideWork）、D5（重算清理）

## 涉及文件

| 文件 | 职责 |
|---|---|
| `src/content/renderer.ts` | 读取 MatchResult，对每个 tag 的 `element` 添加/移除 CSS class |
| `src/content/workEffects.ts` | 作品级效果：warn 边框 + hideWork 折叠 |
| `src/styles/content.css` | 所有 CSS class 定义（见 `09-css-reference.md`） |
| `src/core/priority.ts` | 已实现的 `resolveHighestPriorityAction()`，在 renderer 中使用 |

## 设计思路

### 核心原则

1. **renderer 只做 DOM 操作**——接收纯数据（MatchResult + ParsedWork[]），不关心规则怎么匹配。
2. **先清理，再渲染**——每次调用先移除上一轮的所有 class 和 DOM 插入，再重新应用。这样规则变更后直接调一次就行。
3. **tag 级效果和 work 级效果分开处理**——renderer 处理 tag，workEffects 处理 work。

### 数据流

```
MatchResult
  ├── tagMatches[] → renderer.ts → 给 tag element 加 class
  └── workSummaries[] → workEffects.ts → 给 work element 加 class / 插入折叠条
```

## renderer.ts 实现方案

### 函数签名

```typescript
import type { MatchResult, ParsedWork, ParsedTag, RuleAction } from "../core/types";
import { resolveHighestPriorityAction } from "../core/priority";

export function renderMatches(
  works: readonly ParsedWork[],
  result: MatchResult
): void;

export function clearRenderedMatches(
  works: readonly ParsedWork[]
): void;
```

### 实现步骤

#### 1. 构建 tag 查找表

从 `ParsedWork[]` 中构建一个 `Map<tagId, ParsedTag>`，方便通过 tagId 直接找到 DOM element：

```typescript
const tagMap = new Map<string, ParsedTag>();
for (const work of works) {
  for (const tag of work.tags) {
    tagMap.set(tag.id, tag);
  }
}
```

#### 2. 按 tag 聚合 action

同一个 tag 可能命中多条规则（不同 action），需要聚合后用 `resolveHighestPriorityAction` 取胜者：

```typescript
const tagActions = new Map<string, RuleAction[]>();
for (const match of result.tagMatches) {
  const list = tagActions.get(match.tagId) ?? [];
  list.push(match.action);
  tagActions.set(match.tagId, list);
}
```

#### 3. 清理旧渲染

定义一组 CSS class 常量，清理时统一移除：

```typescript
const TAG_CLASSES = [
  "ao3th-highlight",
  "ao3th-mute",
  "ao3th-warn",
  "ao3th-hide-work",
] as const;

function clearTagClasses(element: HTMLElement): void {
  element.classList.remove(...TAG_CLASSES);
}
```

#### 4. 应用新 class

对每个有命中的 tag，解析最高优先级 action，加上对应 class：

```typescript
for (const [tagId, actions] of tagActions) {
  const tag = tagMap.get(tagId);
  if (!tag) continue;

  clearTagClasses(tag.element);
  const winner = resolveHighestPriorityAction(actions);
  if (winner) {
    tag.element.classList.add(`ao3th-${winner}`);
  }
}
```

注意 `hideWork` 的 class 名映射为 `ao3th-hide-work`（kebab-case）。

#### 5. clearRenderedMatches

全量清理函数，遍历所有 tag 移除 class：

```typescript
export function clearRenderedMatches(works: readonly ParsedWork[]): void {
  for (const work of works) {
    for (const tag of work.tags) {
      clearTagClasses(tag.element);
    }
  }
  clearAllWorkEffects(works); // 调 workEffects 的清理
}
```

### 完整 renderMatches 流程

```
renderMatches(works, result):
  1. clearRenderedMatches(works)      // 先清理
  2. 构建 tagMap
  3. 聚合 tagActions
  4. 遍历 tagActions → resolveHighestPriorityAction → 加 class
  5. applyWorkEffects(works, result)   // 调 workEffects 处理作品级效果
```

## workEffects.ts 实现方案

### 函数签名

```typescript
import type { MatchResult, ParsedWork } from "../core/types";

export function applyWorkEffects(
  works: readonly ParsedWork[],
  result: MatchResult
): void;

export function clearAllWorkEffects(
  works: readonly ParsedWork[]
): void;
```

### 实现步骤

#### 1. 构建 work 查找表

```typescript
const workMap = new Map<string, ParsedWork>();
for (const work of works) {
  workMap.set(work.id, work);
}
```

#### 2. 清理旧的作品级效果

```typescript
const WORK_CLASSES = ["ao3th-work-warn", "ao3th-work-hidden"] as const;
const PLACEHOLDER_SELECTOR = ".ao3th-collapse-placeholder";

export function clearAllWorkEffects(works: readonly ParsedWork[]): void {
  for (const work of works) {
    work.element.classList.remove(...WORK_CLASSES);
    work.element.style.display = "";
    const placeholder = work.element
      .parentElement?.querySelector(`${PLACEHOLDER_SELECTOR}[data-work-id="${work.id}"]`);
    placeholder?.remove();
  }
}
```

#### 3. warn 效果

给命中 warn 的 work element 加一个 class：

```typescript
if (summary.hasWarn) {
  workEl.classList.add("ao3th-work-warn");
}
```

CSS 负责绘制左边框 + 浅红背景（见 `09-css-reference.md`）。

#### 4. hideWork 效果（核心难点）

hideWork 有两种模式（由 `Settings.hideWorkMode` 控制）：

**collapse 模式（默认）：**
- 隐藏 work element（`display: none`）
- 在 work element 后面插入一个占位条 `<div class="ao3th-collapse-placeholder">`
- 占位条显示"此作品已被折叠（点击展开）"
- 点击占位条 → 移除占位条，恢复 work element 显示

**hide 模式：**
- 直接 `display: none`，不插入占位条

```typescript
function applyHideWork(work: ParsedWork, mode: "collapse" | "hide"): void {
  work.element.classList.add("ao3th-work-hidden");
  work.element.style.display = "none";

  if (mode === "collapse") {
    const placeholder = document.createElement("div");
    placeholder.className = "ao3th-collapse-placeholder";
    placeholder.dataset.workId = work.id;
    placeholder.textContent = "此作品已被折叠（点击展开）";
    placeholder.addEventListener("click", () => {
      work.element.style.display = "";
      work.element.classList.remove("ao3th-work-hidden");
      placeholder.remove();
    });
    work.element.insertAdjacentElement("afterend", placeholder);
  }
}
```

#### 5. hideWorkMode 的获取

`applyWorkEffects` 需要知道当前的 `hideWorkMode` 设置。两种方案：

- **方案 A（推荐）：** 作为参数传入 `applyWorkEffects(works, result, hideWorkMode)`
- **方案 B：** 在函数内部调 `getSettings()` 异步获取

推荐方案 A，因为 content script 入口串联时已经读过 settings，直接传入即可，避免重复读取。

### 完整 applyWorkEffects 流程

```
applyWorkEffects(works, result, hideWorkMode):
  1. clearAllWorkEffects(works)
  2. 构建 workMap
  3. 遍历 result.workSummaries:
     - 找到对应 work element
     - hasWarn → 加 ao3th-work-warn class
     - hasHideWork → 调 applyHideWork(work, hideWorkMode)
```

## 需要的 CSS class（在 content.css 中定义）

| Class | 作用 |
|---|---|
| `ao3th-highlight` | tag 高亮背景色 |
| `ao3th-mute` | tag 灰化 / 半透明 |
| `ao3th-warn` | tag 上的 warn 标记（可选，主要效果在 work 级别） |
| `ao3th-hide-work` | tag 上的 hideWork 标记（可选） |
| `ao3th-work-warn` | work 卡片警告边框 |
| `ao3th-work-hidden` | work 卡片隐藏状态 |
| `ao3th-collapse-placeholder` | 折叠占位条样式 |

具体 CSS 值见 `09-css-reference.md`。

## 测试建议

renderer 的逻辑主要是 DOM 操作，测试方式：

1. **单元测试（Vitest + jsdom）：** 构造模拟的 `ParsedWork[]`（内含真实的 DOM element），调用 `renderMatches`，断言 element 的 classList 变化。
2. **测试用例：**
   - 单个 tag 命中 highlight → element 有 `ao3th-highlight`
   - 单个 tag 命中 mute → element 有 `ao3th-mute`
   - 同一 tag 命中 highlight + mute → 只有 `ao3th-highlight`（优先级高）
   - work 命中 warn → work element 有 `ao3th-work-warn`
   - work 命中 hideWork → work element `display: none` + 存在占位条
   - 重算后旧 class 被清理
   - clearRenderedMatches 清空所有标记

## 注意事项

- `ao3th-` 前缀用于避免和 AO3 原生 class 冲突。
- hideWork 的占位条需要插入到 work element 的同级（`afterend`），而不是内部，否则 `display: none` 会一起隐藏掉。
- warn 同时作用于 tag 和 work 两层，tag 上可选地加标记（方便调试），核心视觉效果在 work 级别。
