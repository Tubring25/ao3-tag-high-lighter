import type { MatchMode, Rule, RuleAction, TagCategory } from "../core/types";
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

const ACTIONS: readonly RuleAction[] = ["highlight", "warn", "mute", "hideWork"];
const MATCH_MODES: readonly MatchMode[] = ["exact", "contains", "wildcard"];
const CATEGORIES: readonly TagCategory[] = ["all", "relationship", "character", "freeform"];

export async function renderOptionsApp(
  container: HTMLElement,
  deps: OptionsAppDeps = createRealDeps()
): Promise<void> {
  let allRules = await deps.listRules();
  let filterText = "";
  let filterAction: ActionFilter = "all";

  renderPage();

  function renderPage(): void {
    container.textContent = "";

    const shell = document.createElement("main");
    shell.className = "options-shell";
    shell.dataset.optionsShell = "true";

    renderHeader(shell);
    renderToolbar(shell);
    shell.appendChild(createRuleList());

    container.appendChild(shell);
  }

  function renderHeader(parent: HTMLElement): void {
    const header = document.createElement("header");
    header.className = "options-header";

    const title = document.createElement("h1");
    title.textContent = "AO3 Tag Highlighter";

    const subtitle = document.createElement("p");
    subtitle.textContent = `${allRules.length} rules`;
    subtitle.dataset.optionsCount = "true";

    header.append(title, subtitle);
    parent.appendChild(header);
  }

  function renderToolbar(parent: HTMLElement): void {
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
    for (const action of ACTIONS) {
      appendOption(actionFilter, action, action);
    }
    actionFilter.value = filterAction;
    actionFilter.addEventListener("change", () => {
      filterAction = actionFilter.value as ActionFilter;
      renderFilteredRules();
    });

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "options-add-button";
    addButton.dataset.optionsAdd = "true";
    addButton.textContent = "Add rule";
    addButton.addEventListener("click", () => showRuleForm(null));

    toolbar.append(search, actionFilter, addButton);
    parent.appendChild(toolbar);
  }

  function renderFilteredRules(): void {
    const currentList = container.querySelector<HTMLElement>("[data-options-rule-list]");
    if (!currentList) {
      renderPage();
      return;
    }

    currentList.replaceWith(createRuleList());
  }

  function createRuleList(): HTMLElement {
    const list = document.createElement("section");
    list.className = "options-rule-list";
    list.dataset.optionsRuleList = "true";

    const filteredRules = getFilteredRules();

    if (filteredRules.length === 0) {
      const empty = document.createElement("p");
      empty.className = "options-empty";
      empty.textContent = allRules.length === 0 ? "No rules yet" : "No matching rules";
      list.appendChild(empty);
      return list;
    }

    for (const rule of filteredRules) {
      list.appendChild(createRuleRow(rule));
    }

    return list;
  }

  function getFilteredRules(): Rule[] {
    return allRules.filter((rule) => {
      const matchesText = filterText === "" || rule.pattern.toLowerCase().includes(filterText);
      const matchesAction = filterAction === "all" || rule.action === filterAction;
      return matchesText && matchesAction;
    });
  }

  function createRuleRow(rule: Rule): HTMLElement {
    const row = document.createElement("article");
    row.className = `options-rule-row${rule.enabled ? "" : " is-disabled"}`;
    row.dataset.ruleRow = "true";
    row.dataset.ruleId = rule.id;

    const pattern = document.createElement("div");
    pattern.className = "rule-pattern";
    pattern.textContent = rule.pattern;

    const meta = document.createElement("div");
    meta.className = "rule-meta";
    meta.textContent = `${rule.action} / ${rule.matchMode} / ${rule.category}`;

    const controls = document.createElement("div");
    controls.className = "rule-actions";

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

    const edit = createActionButton("Edit", rule, "edit");
    edit.addEventListener("click", () => showRuleForm(rule));

    const remove = createActionButton("Delete", rule, "delete");
    remove.addEventListener("click", () => {
      void withStorageErrorHandling(async () => {
        if (!deps.confirmDelete(rule)) return;
        await deps.deleteRule(rule.id);
        allRules = allRules.filter((candidate) => candidate.id !== rule.id);
        renderPage();
      });
    });

    controls.append(toggle, edit, remove);
    row.append(pattern, meta, controls);
    return row;
  }

  function createActionButton(label: string, rule: Rule, action: "edit" | "delete"): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.dataset.ruleAction = action;
    button.dataset.ruleId = rule.id;
    return button;
  }

  function showRuleForm(rule: Rule | null): void {
    const overlay = document.createElement("div");
    overlay.className = "options-modal-overlay";
    overlay.dataset.optionsModal = "true";

    const modal = document.createElement("div");
    modal.className = "options-modal";

    const title = document.createElement("h2");
    title.textContent = rule ? "Edit rule" : "Add rule";

    const form = document.createElement("form");
    form.dataset.ruleForm = "true";

    form.append(
      createTextField("pattern", "Pattern", rule?.pattern ?? ""),
      createSelectField("action", "Action", ACTIONS, rule?.action ?? "highlight"),
      createSelectField("matchMode", "Match mode", MATCH_MODES, rule?.matchMode ?? "exact"),
      createSelectField("category", "Category", CATEGORIES, rule?.category ?? "all"),
      createCheckboxField("enabled", "Enabled", rule?.enabled ?? true)
    );

    const footer = document.createElement("div");
    footer.className = "modal-actions";

    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => overlay.remove());

    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = rule ? "Save" : "Create";

    footer.append(cancel, submit);
    form.appendChild(footer);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void withStorageErrorHandling(async () => {
        const input = readRuleForm(form);

        if (rule) {
          const updated = await deps.updateRule(rule.id, input);
          replaceRule(updated);
        } else {
          const created = await deps.addRule({ ...input, source: "manual" });
          allRules = [...allRules, created];
        }

        overlay.remove();
        renderPage();
      });
    });

    modal.append(title, form);
    overlay.appendChild(modal);
    container.appendChild(overlay);
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
  selected: T
): HTMLElement {
  const wrapper = createFieldWrapper(name, label);
  const select = document.createElement("select");
  select.name = name;

  for (const value of values) {
    appendOption(select, value, value);
  }

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
      console.error("[AO3 Tag Highlighter] Options error:", error);
    },
  };
}
