import type { MatchMode, Rule, RuleAction, TagCategory } from "../core/types";
import { LOG_PREFIX } from "../shared/constants";
import {
  addRule as defaultAddRule,
  deleteRule as defaultDeleteRule,
  listRules as defaultListRules,
  toggleRule as defaultToggleRule,
  updateRule as defaultUpdateRule,
} from "../storage/ruleStorage";

type RuleCreateInput = Omit<Rule, "id" | "createdAt" | "updatedAt">;
type RuleUpdateInput = Partial<Omit<Rule, "id" | "createdAt">>;
type ActionFilter = RuleAction | "all";
type CategoryFilter = TagCategory | "all-categories";
type StatusFilter = "all" | "enabled" | "disabled";
type EditorMode = "create" | "edit";

export interface OptionsAppDeps {
  listRules(): Promise<Rule[]>;
  addRule(input: RuleCreateInput): Promise<Rule>;
  updateRule(id: string, patch: RuleUpdateInput): Promise<Rule>;
  deleteRule(id: string): Promise<void>;
  toggleRule(id: string): Promise<Rule>;
  confirmDelete(rule: Rule): boolean;
  alertError(message: string): void;
  logError(error: unknown): void;
}

const ACTIONS: readonly RuleAction[] = ["highlight", "warn", "hideWork"];
const MATCH_MODES: readonly MatchMode[] = ["exact", "contains", "wildcard"];
const CATEGORIES: readonly TagCategory[] = ["all", "relationship", "character", "freeform"];

export async function renderOptionsApp(
  container: HTMLElement,
  deps: OptionsAppDeps = createRealDeps()
): Promise<void> {
  let allRules = await deps.listRules();
  let filterText = "";
  let filterAction: ActionFilter = "all";
  let filterCategory: CategoryFilter = "all-categories";
  let filterStatus: StatusFilter = "all";
  let editorMode: EditorMode = "create";
  let selectedRuleId: string | null = null;
  let editorOpen = false;
  let ruleListScrollTop = 0;

  container.addEventListener("click", closeEditorOnOutsideClick);
  renderPage();

  function renderPage(): void {
    container.textContent = "";

    const shell = document.createElement("main");
    shell.className = "options-shell";
    shell.dataset.optionsShell = "true";

    renderHeader(shell);

    const workspace = document.createElement("section");
    workspace.className = "options-workspace";
    workspace.append(createSidebar(), createManagerPanel());
    shell.appendChild(workspace);

    container.appendChild(shell);
    restoreRuleListScroll();
  }

  function renderHeader(parent: HTMLElement): void {
    const header = document.createElement("header");
    header.className = "options-header";

    const eyebrow = document.createElement("p");
    eyebrow.className = "options-eyebrow";
    eyebrow.textContent = "AO3 Tag Highlighter";

    const title = document.createElement("h1");
    title.textContent = "Rules manager";

    const subtitle = document.createElement("p");
    subtitle.className = "options-subtitle";
    subtitle.textContent = "Create, edit, and pause local tag rules for AO3 search and work pages.";

    const copy = document.createElement("div");
    copy.append(eyebrow, title, subtitle);

    const count = document.createElement("p");
    count.className = "options-count";
    count.textContent = `${allRules.length} rules`;
    count.dataset.optionsCount = "true";

    header.append(copy, count);
    parent.appendChild(header);
  }

  function createSidebar(): HTMLElement {
    const sidebar = document.createElement("aside");
    sidebar.className = "options-sidebar";

    const brand = document.createElement("div");
    brand.className = "options-brand";
    brand.innerHTML = `<strong>AO3 Tag<br>Highlighter</strong><span>Local rule control</span>`;

    const nav = document.createElement("nav");
    nav.className = "options-nav";
    const navItems: Array<[string, StatusFilter, string]> = [
      ["Rules", "all", `${allRules.length}`],
      ["Enabled", "enabled", `${allRules.filter((rule) => rule.enabled).length}`],
      ["Paused", "disabled", `${allRules.filter((rule) => !rule.enabled).length}`],
    ];
    for (const [label, status, value] of navItems) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = status === filterStatus ? "options-nav-item is-active" : "options-nav-item";
      item.dataset.sidebarStatusFilter = status;
      item.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
      item.addEventListener("click", () => {
        rememberRuleListScroll();
        filterStatus = status;
        closeEditorIfSelectionIsFilteredOut();
        renderPage();
      });
      nav.appendChild(item);
    }

    const note = document.createElement("p");
    note.className = "options-sidebar-note";
    note.textContent = "Rules are stored locally in this browser. No sync, no account, no network.";

    sidebar.append(brand, nav, note);
    return sidebar;
  }

  function createManagerPanel(): HTMLElement {
    const panel = document.createElement("section");
    panel.className = "options-manager";

    const top = document.createElement("div");
    top.className = "options-manager-top";

    const copy = document.createElement("div");
    const title = document.createElement("h2");
    title.textContent = "Rules";
    const subtitle = document.createElement("p");
    subtitle.textContent = "Scan, filter, and edit rule behavior from one screen.";
    copy.append(title, subtitle);

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "options-add-button";
    addButton.dataset.optionsAdd = "true";
    addButton.dataset.optionsEditorActivator = "true";
    addButton.textContent = "+ Add rule";
    addButton.addEventListener("click", openCreateEditor);

    top.append(copy, addButton);
    panel.append(top, createFilterBar());

    const content = document.createElement("div");
    content.className = editorOpen ? "options-content-grid has-editor" : "options-content-grid";
    content.append(createRuleList(), createRuleEditor());
    panel.appendChild(content);

    return panel;
  }

  function createFilterBar(): HTMLElement {
    const toolbar = document.createElement("div");
    toolbar.className = "options-toolbar";

    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = "Search pattern...";
    search.value = filterText;
    search.dataset.optionsSearch = "true";
    search.addEventListener("input", () => {
      filterText = search.value.toLowerCase();
      renderFilteredRules();
    });

    const actionFilter = document.createElement("select");
    actionFilter.dataset.optionsActionFilter = "true";
    appendOption(actionFilter, "all", "All actions");
    for (const action of ACTIONS) appendOption(actionFilter, action, formatAction(action));
    actionFilter.value = filterAction;
    actionFilter.addEventListener("change", () => {
      filterAction = actionFilter.value as ActionFilter;
      renderFilteredRules();
    });

    const categoryFilter = document.createElement("select");
    categoryFilter.dataset.optionsCategoryFilter = "true";
    appendOption(categoryFilter, "all-categories", "All categories");
    for (const category of CATEGORIES) appendOption(categoryFilter, category, formatCategory(category));
    categoryFilter.value = filterCategory;
    categoryFilter.addEventListener("change", () => {
      filterCategory = categoryFilter.value as CategoryFilter;
      renderFilteredRules();
    });

    const statusFilter = document.createElement("select");
    statusFilter.dataset.optionsStatusFilter = "true";
    appendOption(statusFilter, "all", "All status");
    appendOption(statusFilter, "enabled", "Enabled");
    appendOption(statusFilter, "disabled", "Paused");
    statusFilter.value = filterStatus;
    statusFilter.addEventListener("change", () => {
      filterStatus = statusFilter.value as StatusFilter;
      renderFilteredRules();
    });

    toolbar.append(search, actionFilter, categoryFilter, statusFilter);
    return toolbar;
  }

  function renderFilteredRules(): void {
    rememberRuleListScroll();
    const currentList = container.querySelector<HTMLElement>("[data-options-rule-list]");
    const currentEditor = container.querySelector<HTMLElement>("[data-options-editor]");
    if (!currentList || !currentEditor) {
      renderPage();
      return;
    }

    const filteredRules = getFilteredRules();
    closeEditorIfSelectionIsFilteredOut(filteredRules);

    currentList.replaceWith(createRuleList());
    currentEditor.replaceWith(createRuleEditor());
    restoreRuleListScroll();
  }

  function closeEditorIfSelectionIsFilteredOut(filteredRules = getFilteredRules()): void {
    if (!editorOpen || editorMode !== "edit" || !selectedRuleId) return;
    if (filteredRules.some((rule) => rule.id === selectedRuleId)) return;
    closeEditor();
  }

  function createRuleList(): HTMLElement {
    const list = document.createElement("section");
    list.className = "options-rule-list";
    list.dataset.optionsRuleList = "true";

    const filteredRules = getFilteredRules();

    if (filteredRules.length === 0) {
      list.appendChild(createEmptyState());
      return list;
    }

    const header = document.createElement("div");
    header.className = "options-table-header";
    for (const label of ["Pattern", "Action", "Match", "Category", "Status", ""] as const) {
      const cell = document.createElement("span");
      cell.textContent = label;
      header.appendChild(cell);
    }
    list.appendChild(header);

    for (const rule of filteredRules) list.appendChild(createRuleRow(rule));

    return list;
  }

  function createEmptyState(): HTMLElement {
    const empty = document.createElement("div");
    empty.className = "options-empty";

    const title = document.createElement("h3");
    title.textContent = allRules.length === 0 ? "No rules yet" : "No matching rules";

    const copy = document.createElement("p");
    copy.textContent =
      allRules.length === 0
        ? "Create your first local tag rule to highlight, warn, or collapse AO3 works."
        : "Try a different search or clear filters to return to your full rule list.";

    const action = document.createElement("button");
    action.type = "button";
    action.className = "options-empty-action";
    action.textContent = allRules.length === 0 ? "Add rule" : "Clear filters";
    if (allRules.length === 0) action.dataset.optionsEditorActivator = "true";
    action.addEventListener("click", () => {
      rememberRuleListScroll();
      if (allRules.length === 0) {
        openCreateEditor();
      } else {
        filterText = "";
        filterAction = "all";
        filterCategory = "all-categories";
        filterStatus = "all";
        closeEditor();
        renderPage();
      }
    });

    empty.append(title, copy, action);
    return empty;
  }

  function getFilteredRules(): Rule[] {
    return allRules.filter((rule) => {
      const matchesText = filterText === "" || rule.pattern.toLowerCase().includes(filterText);
      const matchesAction = filterAction === "all" || rule.action === filterAction;
      const matchesCategory = filterCategory === "all-categories" || rule.category === filterCategory;
      const matchesStatus =
        filterStatus === "all" ||
        (filterStatus === "enabled" && rule.enabled) ||
        (filterStatus === "disabled" && !rule.enabled);
      return matchesText && matchesAction && matchesCategory && matchesStatus;
    });
  }

  function createRuleRow(rule: Rule): HTMLElement {
    const row = document.createElement("article");
    row.className = `options-rule-row${rule.enabled ? "" : " is-disabled"}${
      rule.id === selectedRuleId ? " is-selected" : ""
    }`;
    row.dataset.ruleRow = "true";
    row.dataset.ruleId = rule.id;

    row.append(
      createPatternCell(rule.pattern),
      createBadge("rule-badge", rule.action, formatAction(rule.action)),
      createCell("rule-meta", rule.matchMode),
      createCell("rule-meta", formatCategory(rule.category)),
      createStatusToggle(rule),
      createRowActions(rule)
    );

    row.addEventListener("click", (event) => {
      const target = event.target;
      if (target instanceof HTMLButtonElement || target instanceof HTMLInputElement) return;
      openEditEditor(rule.id);
    });

    return row;
  }

  function createPatternCell(pattern: string): HTMLElement {
    const cell = createCell("rule-pattern", pattern);
    cell.title = pattern;
    return cell;
  }

  function createCell(className: string, text: string): HTMLElement {
    const cell = document.createElement("div");
    cell.className = className;
    cell.textContent = text;
    return cell;
  }

  function createBadge(className: string, action: RuleAction, text: string): HTMLElement {
    const badge = document.createElement("div");
    badge.className = `${className} is-${action}`;
    badge.textContent = text;
    return badge;
  }

  function createStatusToggle(rule: Rule): HTMLElement {
    const label = document.createElement("label");
    label.className = "rule-toggle";

    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.checked = rule.enabled;
    toggle.title = rule.enabled ? "Disable rule" : "Enable rule";
    toggle.dataset.ruleAction = "toggle";
    toggle.dataset.ruleId = rule.id;
    toggle.addEventListener("change", () => {
      void withStorageErrorHandling(async () => {
        const updated = await deps.toggleRule(rule.id);
        replaceRule(updated);
        renderPage();
      });
    });

    const text = document.createElement("span");
    text.textContent = rule.enabled ? "On" : "Paused";
    label.append(toggle, text);
    return label;
  }

  function createRowActions(rule: Rule): HTMLElement {
    const controls = document.createElement("div");
    controls.className = "rule-actions";

    const edit = createActionButton("Edit", rule, "edit");
    edit.dataset.optionsEditorActivator = "true";
    edit.addEventListener("click", () => openEditEditor(rule.id));

    const remove = createActionButton("Delete", rule, "delete");
    remove.addEventListener("click", () => {
      void withStorageErrorHandling(async () => {
        if (!deps.confirmDelete(rule)) return;
        await deps.deleteRule(rule.id);
        allRules = allRules.filter((candidate) => candidate.id !== rule.id);
        if (selectedRuleId === rule.id) closeEditor();
        if (allRules.length === 0) closeEditor();
        rememberRuleListScroll();
        renderPage();
      });
    });

    controls.append(edit, remove);
    return controls;
  }

  function createActionButton(label: string, rule: Rule, action: "edit" | "delete"): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.dataset.ruleAction = action;
    button.dataset.ruleId = rule.id;
    return button;
  }

  function createRuleEditor(): HTMLElement {
    const editor = document.createElement("aside");
    editor.className = editorOpen ? "options-editor is-open" : "options-editor";
    editor.ariaHidden = editorOpen ? "false" : "true";
    editor.dataset.optionsEditor = "true";

    const selectedRule = selectedRuleId ? allRules.find((rule) => rule.id === selectedRuleId) ?? null : null;
    const isEditing = editorMode === "edit" && selectedRule;
    const rule = isEditing ? selectedRule : null;

    const title = document.createElement("h2");
    title.textContent = isEditing && rule ? `Editing “${rule.pattern}”` : "New local rule";

    const mode = document.createElement("p");
    mode.className = "options-editor-mode";
    mode.textContent = isEditing ? "Edit selected rule" : "Create rule";

    const hint = document.createElement("p");
    hint.className = "options-editor-hint";
    hint.textContent = isEditing
      ? "Save changes to update AO3 pages after the next render."
      : "Create a local rule from a tag pattern.";

    const form = document.createElement("form");
    form.dataset.ruleForm = "true";

    form.append(
      createTextField("pattern", "Pattern", rule?.pattern ?? ""),
      createSelectField("action", "Action", ACTIONS, rule?.action ?? "highlight", formatAction),
      createSelectField("matchMode", "Match mode", MATCH_MODES, rule?.matchMode ?? "exact"),
      createSelectField("category", "Category", CATEGORIES, rule?.category ?? "all", formatCategory),
      createCheckboxField("enabled", "Enabled", rule?.enabled ?? true)
    );

    const footer = document.createElement("div");
    footer.className = "editor-actions";

    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = isEditing ? "Save" : "Create";

    footer.appendChild(submit);
    form.appendChild(footer);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void withStorageErrorHandling(async () => {
        const input = readRuleForm(form);

        if (isEditing && rule) {
          const updated = await deps.updateRule(rule.id, input);
          replaceRule(updated);
        } else {
          const created = await deps.addRule({ ...input, source: "manual" });
          allRules = [...allRules, created];
        }

        closeEditor();
        renderPage();
      });
    });

    editor.append(mode, title, hint, form);
    return editor;
  }

  async function withStorageErrorHandling(operation: () => Promise<void>): Promise<void> {
    try {
      await operation();
    } catch (error) {
      deps.logError(error);
      deps.alertError(error instanceof Error ? error.message : "Operation failed");
      renderPage();
    }
  }

  function replaceRule(updated: Rule): void {
    allRules = allRules.map((rule) => (rule.id === updated.id ? updated : rule));
  }

  function openCreateEditor(): void {
    rememberRuleListScroll();
    editorMode = "create";
    selectedRuleId = null;
    editorOpen = true;
    renderPage();
  }

  function openEditEditor(ruleId: string): void {
    rememberRuleListScroll();
    editorMode = "edit";
    selectedRuleId = ruleId;
    editorOpen = true;
    renderPage();
  }

  function closeEditor(): void {
    editorMode = "create";
    selectedRuleId = null;
    editorOpen = false;
  }

  function closeEditorOnOutsideClick(event: MouseEvent): void {
    const target = event.target;
    if (!editorOpen || !(target instanceof Element)) return;
    if (
      target.closest("[data-options-editor]") ||
      target.closest("[data-options-rule-list]") ||
      target.closest("[data-options-editor-activator]")
    ) {
      return;
    }

    rememberRuleListScroll();
    closeEditor();
    renderPage();
  }

  function rememberRuleListScroll(): void {
    const list = container.querySelector<HTMLElement>("[data-options-rule-list]");
    if (list) ruleListScrollTop = list.scrollTop;
  }

  function restoreRuleListScroll(): void {
    const list = container.querySelector<HTMLElement>("[data-options-rule-list]");
    if (list) list.scrollTop = ruleListScrollTop;
  }
}

function createTextField(name: string, label: string, value: string): HTMLElement {
  const wrapper = createFieldWrapper(name, label);
  const input = document.createElement("input");
  input.type = "text";
  input.name = name;
  input.value = value;
  input.required = true;
  wrapper.appendChild(input);
  return wrapper;
}

function createSelectField<T extends string>(
  name: string,
  label: string,
  values: readonly T[],
  selected: T,
  format: (value: T) => string = (value) => value
): HTMLElement {
  const wrapper = createFieldWrapper(name, label);
  const select = document.createElement("select");
  select.name = name;

  for (const value of values) appendOption(select, value, format(value));

  select.value = selected;
  wrapper.appendChild(select);
  return wrapper;
}

function createCheckboxField(name: string, label: string, checked: boolean): HTMLElement {
  const wrapper = document.createElement("label");
  wrapper.className = "form-field form-field-checkbox";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.name = name;
  input.checked = checked;
  wrapper.append(input, document.createTextNode(label));
  return wrapper;
}

function createFieldWrapper(name: string, label: string): HTMLElement {
  const wrapper = document.createElement("label");
  wrapper.className = "form-field";
  wrapper.htmlFor = name;
  const labelText = document.createElement("span");
  labelText.textContent = label;
  wrapper.appendChild(labelText);
  return wrapper;
}

function readRuleForm(form: HTMLFormElement): RuleUpdateInput & RuleCreateInput {
  const formData = new FormData(form);
  return {
    pattern: String(formData.get("pattern") ?? ""),
    action: formData.get("action") as RuleAction,
    matchMode: formData.get("matchMode") as MatchMode,
    category: formData.get("category") as TagCategory,
    enabled: formData.get("enabled") === "on",
  };
}

function appendOption(select: HTMLSelectElement, value: string, label: string): void {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  select.appendChild(option);
}

function formatAction(action: RuleAction): string {
  if (action === "hideWork") return "Collapse work";
  return action;
}

function formatCategory(category: TagCategory): string {
  if (category === "all") return "Any category";
  return category;
}

function createRealDeps(): OptionsAppDeps {
  return {
    listRules: defaultListRules,
    addRule: defaultAddRule,
    updateRule: defaultUpdateRule,
    deleteRule: defaultDeleteRule,
    toggleRule: defaultToggleRule,
    confirmDelete: (rule) => window.confirm(`Delete rule "${rule.pattern}"?`),
    alertError: (message) => window.alert(message),
    logError: (error) => {
      console.error(`${LOG_PREFIX} Options error:`, error);
    },
  };
}
