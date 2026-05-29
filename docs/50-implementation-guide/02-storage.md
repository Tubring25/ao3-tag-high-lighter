# 02 — 本地存储：ruleStorage.ts + settingsStorage.ts

对应 checklist：E1（规则 CRUD）、E2（设置读写）、E3（数据校验）

## 涉及文件

| 文件 | 职责 |
|---|---|
| `src/storage/ruleStorage.ts` | 规则的增删改查，读写 `chrome.storage.local` |
| `src/storage/settingsStorage.ts` | 全局设置的读写，带默认值 |
| `src/shared/constants.ts` | 存储 key 常量 |
| `src/shared/utils.ts` | 可能需要的 ID 生成函数 |

## chrome.storage.local 基础

### API 概览

```typescript
// 读取
const result = await chrome.storage.local.get("key");
const value = result["key"]; // 不存在时为 undefined

// 写入
await chrome.storage.local.set({ key: value });

// 删除
await chrome.storage.local.remove("key");

// 读全部
const all = await chrome.storage.local.get(null);
```

### 存储 key 设计

在 `src/shared/constants.ts` 中定义：

```typescript
export const EXTENSION_NAME = "AO3 Tag Highlighter";
export const STORAGE_KEY_RULES = "ao3th_rules";
export const STORAGE_KEY_SETTINGS = "ao3th_settings";
```

### 存储结构

```
chrome.storage.local:
  ao3th_rules: Rule[]        // 规则数组
  ao3th_settings: Settings   // 设置对象
```

## ruleStorage.ts 实现方案

### 需要导出的函数

```typescript
import type { Rule } from "../core/types";

// 读取全部规则
export async function listRules(): Promise<Rule[]>;

// 按 ID 读取单条规则
export async function getRule(id: string): Promise<Rule | null>;

// 新增一条规则（自动生成 id / createdAt / updatedAt）
export async function addRule(
  input: Omit<Rule, "id" | "createdAt" | "updatedAt">
): Promise<Rule>;

// 更新一条规则（自动更新 updatedAt）
export async function updateRule(
  id: string,
  patch: Partial<Omit<Rule, "id" | "createdAt">>
): Promise<Rule>;

// 删除一条规则
export async function deleteRule(id: string): Promise<void>;

// 切换启停状态
export async function toggleRule(id: string): Promise<Rule>;

// 数据校验
export function validateRuleInput(input: Partial<Rule>): void;
```

### 实现细节

#### ID 生成

在 `src/shared/utils.ts` 中添加：

```typescript
export function generateId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
```

`crypto.randomUUID()` 在 Chrome Extension 的 service worker 和 content script 中均可用；fallback 用于测试环境或受限运行时。

#### listRules

```typescript
import { STORAGE_KEY_RULES } from "../shared/constants";

export async function listRules(): Promise<Rule[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY_RULES);
  const rules = result[STORAGE_KEY_RULES];
  return Array.isArray(rules) ? rules : [];
}
```

#### addRule

```typescript
export async function addRule(
  input: Omit<Rule, "id" | "createdAt" | "updatedAt">
): Promise<Rule> {
  validateRuleInput(input);
  const rules = await listRules();
  assertNoDuplicateRule(input, rules);

  const now = Date.now();
  const rule: Rule = {
    ...input,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };

  await chrome.storage.local.set({ [STORAGE_KEY_RULES]: [...rules, rule] });
  await notifyUpdate("RULES_UPDATED");
  return rule;
}
```

#### updateRule

```typescript
export async function updateRule(
  id: string,
  patch: Partial<Omit<Rule, "id" | "createdAt">>
): Promise<Rule> {
  const rules = await listRules();
  const index = rules.findIndex((r) => r.id === id);
  if (index === -1) throw new Error(`Rule not found: ${id}`);

  const updated: Rule = {
    ...rules[index],
    ...patch,
    id: rules[index].id,
    createdAt: rules[index].createdAt,
    updatedAt: Date.now(),
  };

  validateRuleInput(updated);
  assertNoDuplicateRule(updated, rules, id);

  rules[index] = updated;
  await chrome.storage.local.set({ [STORAGE_KEY_RULES]: rules });
  await notifyUpdate("RULES_UPDATED");
  return updated;
}
```

`addRule()` 和 `updateRule()` 会拒绝完全重复的规则。重复判定使用：

```text
normalizeTagText(pattern) + action + matchMode + category
```

这会阻止完全相同规则被重复添加，但仍允许同一 tag/pattern 配置不同 action；不同 action 的最终显示仍由 renderer 优先级解析。

#### deleteRule

```typescript
export async function deleteRule(id: string): Promise<void> {
  const rules = await listRules();
  const filtered = rules.filter((r) => r.id !== id);
  await chrome.storage.local.set({ [STORAGE_KEY_RULES]: filtered });
  await notifyUpdate("RULES_UPDATED");
}
```

#### toggleRule

```typescript
export async function toggleRule(id: string): Promise<Rule> {
  const rules = await listRules();
  const index = rules.findIndex((r) => r.id === id);
  if (index === -1) throw new Error(`Rule not found: ${id}`);

  rules[index] = {
    ...rules[index],
    enabled: !rules[index].enabled,
    updatedAt: Date.now(),
  };

  await chrome.storage.local.set({ [STORAGE_KEY_RULES]: rules });
  await notifyUpdate("RULES_UPDATED");
  return rules[index];
}
```

### 数据校验（E3）

```typescript
function validateRuleInput(input: Partial<Rule>): void {
  if (!input.pattern || input.pattern.trim() === "") {
    throw new Error("Rule pattern cannot be empty");
  }

  const validActions = ["highlight", "warn", "mute", "hideWork"];
  if (!validActions.includes(input.action as string)) {
    throw new Error(`Invalid action: ${input.action}`);
  }

  const validModes = ["exact", "contains", "wildcard"];
  if (!validModes.includes(input.matchMode as string)) {
    throw new Error(`Invalid matchMode: ${input.matchMode}`);
  }

  const validCategories = ["relationship", "character", "freeform", "all"];
  if (!validCategories.includes(input.category as string)) {
    throw new Error(`Invalid category: ${input.category}`);
  }

  if (typeof input.enabled !== "boolean") {
    throw new Error("Invalid enabled: expected boolean");
  }
}
```

## settingsStorage.ts 实现方案

### 默认设置

```typescript
import type { Settings } from "../core/types";
import { STORAGE_KEY_SETTINGS } from "../shared/constants";

const DEFAULT_SETTINGS: Settings = {
  extensionEnabled: true,
  hoverButtonEnabled: true,
  showToast: true,
  hideWorkMode: "collapse",
  enableOnWorkDetailPage: true,
};
```

### 需要导出的函数

```typescript
// 读取设置（不存在时返回默认值）
export async function getSettings(): Promise<Settings>;

// 写入设置（合并式更新）
export async function saveSettings(
  patch: Partial<Settings>
): Promise<Settings>;

// 重置为默认设置
export async function resetSettings(): Promise<Settings>;

// 数据校验
export function validateSettingsInput(input: Partial<Settings>): void;
```

### 实现细节

#### getSettings

```typescript
export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get(STORAGE_KEY_SETTINGS);
  const stored = result[STORAGE_KEY_SETTINGS];
  const settings = { ...DEFAULT_SETTINGS, ...(isObjectRecord(stored) ? stored : {}) };
  validateSettingsInput(settings);
  return settings;
}
```

用 `{ ...DEFAULT_SETTINGS, ...stored }` 确保新版本新增的字段不会缺失。

#### saveSettings

```typescript
export async function saveSettings(
  patch: Partial<Settings>
): Promise<Settings> {
  const current = await getSettings();
  const updated = { ...current, ...patch };
  validateSettingsInput(updated);
  await chrome.storage.local.set({ [STORAGE_KEY_SETTINGS]: updated });
  await notifyUpdate("SETTINGS_UPDATED");
  return updated;
}
```

#### resetSettings

```typescript
export async function resetSettings(): Promise<Settings> {
  const defaults = { ...DEFAULT_SETTINGS };
  await chrome.storage.local.set({ [STORAGE_KEY_SETTINGS]: defaults });
  await notifyUpdate("SETTINGS_UPDATED");
  return defaults;
}
```

## 变更通知

规则或设置更新后，需要通知 content script 重新渲染。使用 `chrome.runtime.sendMessage`：

```typescript
// 在 ruleStorage 的每个写操作末尾加：
await chrome.runtime.sendMessage({ type: "RULES_UPDATED" });

// 在 settingsStorage 的每个写操作末尾加：
await chrome.runtime.sendMessage({ type: "SETTINGS_UPDATED" });
```

消息类型已在 `src/shared/message.ts` 中定义。

**注意：** `sendMessage` 在没有 listener 时会抛错。需要在 background service worker 中注册 listener 做中转（见 `07-background.md`），或者用 `try/catch` 包裹。推荐在 storage 层用 `try/catch` 兜底：

```typescript
async function notifyUpdate(type: "RULES_UPDATED" | "SETTINGS_UPDATED"): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ type });
  } catch {
    // listener 不存在时忽略（如独立页面打开 options）
  }
}
```

## 测试建议

chrome.storage.local 在 Vitest + jsdom 中不存在，有两种测试方式：

### 方案 A：Mock chrome.storage（推荐）

在测试文件顶部 mock：

```typescript
const store: Record<string, unknown> = {};

const mockStorage = {
  local: {
    get: vi.fn(async (key: string | null) => {
      if (key === null) return { ...store };
      return { [key]: store[key] };
    }),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(store, items);
    }),
    remove: vi.fn(async (key: string) => {
      delete store[key];
    }),
  },
};

vi.stubGlobal("chrome", { storage: mockStorage, runtime: { sendMessage: vi.fn() } });
```

### 方案 B：不写自动化测试

storage 逻辑比较 CRUD 化，在真实浏览器中手动验证也可。如果选择这个方案，至少保证：

- 在 Chrome DevTools 的 Application > Storage 面板中能看到数据
- 添加、修改、删除后数据正确更新

## 注意事项

- `chrome.storage.local` 有 10MB 上限（非 `unlimitedStorage`），MVP 足够。
- 规则数组整体读写（而非每条规则一个 key），简化实现。如果未来规则量极大（上千条），再考虑拆分。
- `addRule` 的参数不含 `id` / `createdAt` / `updatedAt`，这三个字段由 storage 层自动生成，调用方不需关心。
