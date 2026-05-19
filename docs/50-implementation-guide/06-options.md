# 06 — Options 规则管理页

对应 checklist：H1（规则列表）、H2（搜索筛选）、H3（新增规则）、H4（编辑规则）、H5（删除规则）、H6（启停规则）

## 涉及文件

| 文件 | 职责 |
|---|---|
| `options.html` | options HTML 入口，build 后输出为 `dist/options.html` |
| `src/options/index.ts` | options 逻辑（Vanilla DOM） |
| `src/options/options.css` | options 样式 |
| `src/storage/ruleStorage.ts` | 规则 CRUD |

## UI 布局

```
┌─────────────────────────────────────────────────────────────┐
│  AO3 Tag Highlighter — 规则管理                              │
│                                                             │
│  ┌──────────────────────┐  ┌────────┐  ┌──────────────────┐ │
│  │ 🔍 搜索规则...       │  │ 筛选 ▾ │  │ + 添加新规则     │ │
│  └──────────────────────┘  └────────┘  └──────────────────┘ │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Pattern      │ Action    │ Match  │ Category │ 操作    │ │
│  ├──────────────┼──────────┼────────┼──────────┼─────────│ │
│  │ Fluff        │ 🌟 高亮  │ exact  │ freeform │ [✓][✎][🗑]│
│  │ *angst*      │ ⚠ 警告   │ wild   │ all      │ [✓][✎][🗑]│
│  │ OC           │ 👻 弱化  │ exact  │ character│ [✓][✎][🗑]│
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  共 3 条规则                                                 │
└─────────────────────────────────────────────────────────────┘
```

## 实现方案

### 页面结构

options 页面由以下几个部分组成：

1. **顶栏**：标题
2. **工具栏**：搜索框 + 筛选下拉 + 新增按钮
3. **规则列表**：表格或卡片列表
4. **规则编辑弹窗**：新增 / 编辑时弹出的表单

### index.ts 整体结构

```typescript
import "./options.css";
import { listRules, addRule, updateRule, deleteRule, toggleRule } from "../storage/ruleStorage";
import type { Rule, RuleAction, MatchMode, TagCategory } from "../core/types";

let allRules: Rule[] = [];
let filterText = "";
let filterAction: RuleAction | "all" = "all";

async function main(): Promise<void> {
  const app = document.querySelector<HTMLDivElement>("#app");
  if (!app) return;

  allRules = await listRules();
  renderPage(app);
}

function renderPage(app: HTMLElement): void {
  app.innerHTML = "";

  renderHeader(app);
  renderToolbar(app);
  renderRuleList(app);
  renderFooter(app);
}

main().catch(console.error);
```

### 1. renderToolbar — 搜索筛选 + 新增按钮

```typescript
function renderToolbar(container: HTMLElement): void {
  const toolbar = document.createElement("div");
  toolbar.className = "options-toolbar";

  // 搜索框
  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.placeholder = "搜索规则 pattern...";
  searchInput.className = "options-search";
  searchInput.value = filterText;
  searchInput.addEventListener("input", () => {
    filterText = searchInput.value.toLowerCase();
    rerenderList();
  });

  // 筛选下拉
  const filterSelect = document.createElement("select");
  filterSelect.className = "options-filter";
  const filterOptions = [
    { value: "all", label: "全部 Action" },
    { value: "highlight", label: "🌟 高亮" },
    { value: "warn", label: "⚠️ 警告" },
    { value: "mute", label: "👻 弱化" },
    { value: "hideWork", label: "🙈 折叠" },
  ];
  for (const opt of filterOptions) {
    const option = document.createElement("option");
    option.value = opt.value;
    option.textContent = opt.label;
    filterSelect.appendChild(option);
  }
  filterSelect.value = filterAction;
  filterSelect.addEventListener("change", () => {
    filterAction = filterSelect.value as RuleAction | "all";
    rerenderList();
  });

  // 新增按钮
  const addBtn = document.createElement("button");
  addBtn.className = "options-add-btn";
  addBtn.textContent = "+ 添加新规则";
  addBtn.addEventListener("click", () => {
    showRuleForm(null); // null 表示新增
  });

  toolbar.appendChild(searchInput);
  toolbar.appendChild(filterSelect);
  toolbar.appendChild(addBtn);
  container.appendChild(toolbar);
}
```

### 2. renderRuleList — 规则列表

```typescript
let listContainer: HTMLElement | null = null;

function renderRuleList(container: HTMLElement): void {
  listContainer = document.createElement("div");
  listContainer.className = "options-rule-list";
  container.appendChild(listContainer);
  rerenderList();
}

function rerenderList(): void {
  if (!listContainer) return;
  listContainer.innerHTML = "";

  const filtered = allRules.filter((rule) => {
    const matchesText = filterText === "" ||
      rule.pattern.toLowerCase().includes(filterText);
    const matchesAction = filterAction === "all" || rule.action === filterAction;
    return matchesText && matchesAction;
  });

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "options-empty";
    empty.textContent = filterText || filterAction !== "all"
      ? "没有匹配的规则"
      : "还没有任何规则，点击"添加新规则"开始";
    listContainer.appendChild(empty);
    return;
  }

  for (const rule of filtered) {
    listContainer.appendChild(createRuleRow(rule));
  }
}
```

### 3. createRuleRow — 单条规则行

```typescript
const ACTION_LABELS: Record<RuleAction, string> = {
  highlight: "🌟 高亮",
  warn: "⚠️ 警告",
  mute: "👻 弱化",
  hideWork: "🙈 折叠",
};

function createRuleRow(rule: Rule): HTMLElement {
  const row = document.createElement("div");
  row.className = `options-rule-row ${rule.enabled ? "" : "disabled"}`;
  row.dataset.ruleId = rule.id;

  // Pattern
  const patternEl = document.createElement("span");
  patternEl.className = "rule-pattern";
  patternEl.textContent = rule.pattern;

  // Action
  const actionEl = document.createElement("span");
  actionEl.className = "rule-action";
  actionEl.textContent = ACTION_LABELS[rule.action];

  // Match mode
  const modeEl = document.createElement("span");
  modeEl.className = "rule-mode";
  modeEl.textContent = rule.matchMode;

  // Category
  const categoryEl = document.createElement("span");
  categoryEl.className = "rule-category";
  categoryEl.textContent = rule.category;

  // 操作按钮
  const actions = document.createElement("div");
  actions.className = "rule-actions";

  // 启停 toggle
  const toggleBtn = document.createElement("input");
  toggleBtn.type = "checkbox";
  toggleBtn.checked = rule.enabled;
  toggleBtn.title = rule.enabled ? "点击停用" : "点击启用";
  toggleBtn.addEventListener("change", async () => {
    const updated = await toggleRule(rule.id);
    const index = allRules.findIndex((r) => r.id === rule.id);
    if (index !== -1) allRules[index] = updated;
    rerenderList();
    await notifyRulesUpdated();
  });

  // 编辑
  const editBtn = document.createElement("button");
  editBtn.className = "rule-btn-edit";
  editBtn.textContent = "✎";
  editBtn.title = "编辑";
  editBtn.addEventListener("click", () => showRuleForm(rule));

  // 删除
  const deleteBtn = document.createElement("button");
  deleteBtn.className = "rule-btn-delete";
  deleteBtn.textContent = "🗑";
  deleteBtn.title = "删除";
  deleteBtn.addEventListener("click", async () => {
    if (!confirm(`确认删除规则 "${rule.pattern}"？`)) return;
    await deleteRule(rule.id);
    allRules = allRules.filter((r) => r.id !== rule.id);
    rerenderList();
    await notifyRulesUpdated();
  });

  actions.appendChild(toggleBtn);
  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);

  row.appendChild(patternEl);
  row.appendChild(actionEl);
  row.appendChild(modeEl);
  row.appendChild(categoryEl);
  row.appendChild(actions);

  return row;
}
```

### 4. showRuleForm — 新增 / 编辑弹窗

使用一个 modal overlay，覆盖在页面上：

```typescript
function showRuleForm(existingRule: Rule | null): void {
  const isEdit = existingRule !== null;

  // 创建 overlay
  const overlay = document.createElement("div");
  overlay.className = "options-modal-overlay";

  const modal = document.createElement("div");
  modal.className = "options-modal";

  const title = document.createElement("h2");
  title.textContent = isEdit ? "编辑规则" : "新增规则";
  modal.appendChild(title);

  // 表单字段
  const form = document.createElement("form");

  // Pattern
  form.appendChild(createField("pattern", "Pattern（匹配文本）", "text",
    existingRule?.pattern ?? ""));

  // Action
  form.appendChild(createSelectField("action", "Action（效果）", [
    { value: "highlight", label: "🌟 高亮" },
    { value: "warn", label: "⚠️ 警告" },
    { value: "mute", label: "👻 弱化" },
    { value: "hideWork", label: "🙈 折叠作品" },
  ], existingRule?.action ?? "highlight"));

  // Match Mode
  form.appendChild(createSelectField("matchMode", "匹配模式", [
    { value: "exact", label: "精确匹配" },
    { value: "contains", label: "包含匹配" },
    { value: "wildcard", label: "通配符 *" },
  ], existingRule?.matchMode ?? "exact"));

  // Category
  form.appendChild(createSelectField("category", "Tag 类型", [
    { value: "all", label: "全部" },
    { value: "relationship", label: "Relationship" },
    { value: "character", label: "Character" },
    { value: "freeform", label: "Freeform" },
  ], existingRule?.category ?? "all"));

  // 按钮
  const btnGroup = document.createElement("div");
  btnGroup.className = "modal-btn-group";

  const saveBtn = document.createElement("button");
  saveBtn.type = "submit";
  saveBtn.className = "modal-btn-save";
  saveBtn.textContent = isEdit ? "保存" : "创建";

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "modal-btn-cancel";
  cancelBtn.textContent = "取消";
  cancelBtn.addEventListener("click", () => overlay.remove());

  btnGroup.appendChild(cancelBtn);
  btnGroup.appendChild(saveBtn);
  form.appendChild(btnGroup);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(form);

    const data = {
      pattern: formData.get("pattern") as string,
      action: formData.get("action") as RuleAction,
      matchMode: formData.get("matchMode") as MatchMode,
      category: formData.get("category") as TagCategory,
      enabled: existingRule?.enabled ?? true,
    };

    try {
      if (isEdit) {
        const updated = await updateRule(existingRule.id, data);
        const index = allRules.findIndex((r) => r.id === existingRule.id);
        if (index !== -1) allRules[index] = updated;
      } else {
        const created = await addRule(data);
        allRules.push(created);
      }

      overlay.remove();
      rerenderList();
      await notifyRulesUpdated();
    } catch (err) {
      alert(`保存失败: ${(err as Error).message}`);
    }
  });

  modal.appendChild(form);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}
```

辅助函数：

```typescript
function createField(
  name: string, label: string, type: string, value: string
): HTMLElement {
  const group = document.createElement("div");
  group.className = "form-group";

  const labelEl = document.createElement("label");
  labelEl.textContent = label;
  labelEl.htmlFor = name;

  const input = document.createElement("input");
  input.type = type;
  input.name = name;
  input.id = name;
  input.value = value;
  input.required = true;

  group.appendChild(labelEl);
  group.appendChild(input);
  return group;
}

function createSelectField(
  name: string, label: string,
  options: { value: string; label: string }[],
  selected: string
): HTMLElement {
  const group = document.createElement("div");
  group.className = "form-group";

  const labelEl = document.createElement("label");
  labelEl.textContent = label;
  labelEl.htmlFor = name;

  const select = document.createElement("select");
  select.name = name;
  select.id = name;

  for (const opt of options) {
    const option = document.createElement("option");
    option.value = opt.value;
    option.textContent = opt.label;
    if (opt.value === selected) option.selected = true;
    select.appendChild(option);
  }

  group.appendChild(labelEl);
  group.appendChild(select);
  return group;
}
```

### 5. 通知 content script 规则已变更

```typescript
async function notifyRulesUpdated(): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ type: "RULES_UPDATED" });
  } catch {
    // background 未加载时忽略
  }
}
```

这里通过 background 中转给所有 AO3 tab（见 `07-background.md`）。

### options.css 样式参考

```css
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  color: #333;
  background: #f9f9f9;
}

.options-shell {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px;
}

.options-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  align-items: center;
}

.options-search {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

.options-filter {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 6px;
}

.options-add-btn {
  padding: 8px 16px;
  background: #4a90d9;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.options-add-btn:hover {
  background: #3a7bc8;
}

.options-rule-list {
  background: #fff;
  border: 1px solid #eee;
  border-radius: 8px;
  overflow: hidden;
}

.options-rule-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.options-rule-row:last-child {
  border-bottom: none;
}

.options-rule-row.disabled {
  opacity: 0.5;
}

.rule-pattern {
  flex: 1;
  font-weight: 500;
  font-family: monospace;
}

.rule-action,
.rule-mode,
.rule-category {
  width: 80px;
  text-align: center;
  font-size: 12px;
  color: #666;
}

.rule-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.rule-btn-edit,
.rule-btn-delete {
  border: none;
  background: none;
  cursor: pointer;
  font-size: 16px;
  padding: 4px;
}

.rule-btn-delete:hover {
  color: #e74c3c;
}

.options-empty {
  padding: 40px;
  text-align: center;
  color: #999;
}

/* Modal */
.options-modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.options-modal {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  min-width: 400px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.options-modal h2 {
  margin: 0 0 16px;
  font-size: 18px;
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  margin-bottom: 4px;
  font-size: 13px;
  color: #555;
}

.form-group input,
.form-group select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  box-sizing: border-box;
}

.modal-btn-group {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.modal-btn-save {
  padding: 8px 20px;
  background: #4a90d9;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.modal-btn-cancel {
  padding: 8px 20px;
  background: #eee;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
```

## 注意事项

- options 页面是独立的 Chrome 扩展页面（`chrome-extension://...`），可以直接使用 `chrome.storage` API。
- 规则变更后需要通知 content script 重新渲染。options 页面通过 `chrome.runtime.sendMessage` 发给 background，background 再广播给所有 AO3 tab。
- Vanilla DOM 操作虽然代码量大，但对于规则管理这种简单表单来说完全够用。如果觉得太繁琐，可以考虑封装一些简单的 DOM helper 函数。
- 表单校验依赖 storage 层的 `validateRuleInput`，前端做基本的 required 校验即可。
- 删除前建议加 `confirm` 确认，防止误删。
