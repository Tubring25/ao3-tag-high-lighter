import type {
  CustomizableRuleAction,
  LanguagePreference,
  MatchMode,
  Rule,
  RuleAction,
  RuleActionStyles,
  Settings,
  TagCategory,
} from "../core/types";
import { ACTION_STYLE_PRESETS } from "../core/actionStyles";
import { LOG_PREFIX } from "../shared/constants";
import {
  getLocalizedActionLabel,
  getLocalizedCustomizableActionLabel,
  getLocalizedPresetName,
  applyDocumentLanguage,
  setLanguagePreference,
  t,
} from "../shared/i18n";
import {
  addRule as defaultAddRule,
  deleteRule as defaultDeleteRule,
  deleteRules as defaultDeleteRules,
  listRules as defaultListRules,
  toggleRule as defaultToggleRule,
  updateRule as defaultUpdateRule,
} from "../storage/ruleStorage";
import {
  getSettings as defaultGetSettings,
  saveSettings as defaultSaveSettings,
} from "../storage/settingsStorage";

type RuleCreateInput = Omit<Rule, "id" | "createdAt" | "updatedAt">;
type RuleUpdateInput = Partial<Omit<Rule, "id" | "createdAt">>;
type ActionFilter = RuleAction | "all";
type CategoryFilter = TagCategory | "all-categories";
type StatusFilter = "all" | "enabled" | "disabled";
type EditorMode = "create" | "edit" | "styles";

export interface OptionsAppDeps {
  listRules(): Promise<Rule[]>;
  addRule(input: RuleCreateInput): Promise<Rule>;
  updateRule(id: string, patch: RuleUpdateInput): Promise<Rule>;
  deleteRule(id: string): Promise<void>;
  deleteRules(ids: readonly string[]): Promise<void>;
  toggleRule(id: string): Promise<Rule>;
  getSettings(): Promise<Settings>;
  saveSettings(patch: Partial<Settings>): Promise<Settings>;
  confirmDelete(rule: Rule): boolean;
  confirmBulkDelete(count: number): boolean;
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
  let settings = await deps.getSettings();
  let filterText = "";
  let filterAction: ActionFilter = "all";
  let filterCategory: CategoryFilter = "all-categories";
  let filterStatus: StatusFilter = "all";
  let editorMode: EditorMode = "create";
  let selectedRuleId: string | null = null;
  let selectedRuleIds = new Set<string>();
  let editorOpen = false;
  let ruleListScrollTop = 0;

  setLanguagePreference(settings.languagePreference);
  applyDocumentLanguage();
  container.addEventListener("click", closeEditorOnOutsideClick);
  renderPage();

  function renderPage(): void {
    syncSelectedRuleIds();
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
    eyebrow.textContent = t("optionsEyebrow");

    const title = document.createElement("h1");
    title.textContent = t("optionsTitle");

    const subtitle = document.createElement("p");
    subtitle.className = "options-subtitle";
    subtitle.textContent = t("optionsSubtitle");

    const copy = document.createElement("div");
    copy.append(eyebrow, title, subtitle);

    const count = document.createElement("p");
    count.className = "options-count";
    count.textContent = t("optionsRulesCount", [allRules.length]);
    count.dataset.optionsCount = "true";

    header.append(copy, count);
    parent.appendChild(header);
  }

  function createSidebar(): HTMLElement {
    const sidebar = document.createElement("aside");
    sidebar.className = "options-sidebar";

    const brand = document.createElement("div");
    brand.className = "options-brand";
    brand.innerHTML = `<strong>AO3 Tag<br>Highlighter</strong><span>${t("optionsRuleSettings")}</span>`;

    const nav = document.createElement("nav");
    nav.className = "options-nav";
    const navItems: Array<[string, StatusFilter, string]> = [
      [t("optionsRules"), "all", `${allRules.length}`],
      [t("optionsNavEnabled"), "enabled", `${allRules.filter((rule) => rule.enabled).length}`],
      [t("optionsNavPaused"), "disabled", `${allRules.filter((rule) => !rule.enabled).length}`],
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
    note.textContent = t("optionsSavedInBrowser");

    sidebar.append(brand, nav, createLanguageSetting(), note);
    return sidebar;
  }

  function createLanguageSetting(): HTMLElement {
    const control = document.createElement("label");
    control.className = "options-language-control";
    control.dataset.optionsSidebarControl = "true";

    const label = document.createElement("span");
    label.className = "options-language-label";
    label.textContent = t("languageLabel");

    const select = document.createElement("select");
    select.dataset.optionsLanguage = "true";
    appendOption(select, "auto", t("languageAuto"));
    appendOption(select, "en", t("languageEnglish"));
    appendOption(select, "zh_CN", t("languageChineseSimplified"));
    select.value = settings.languagePreference;
    select.addEventListener("change", () => {
      const languagePreference = select.value as LanguagePreference;
      void withStorageErrorHandling(async () => {
        settings = await deps.saveSettings({ languagePreference });
        setLanguagePreference(settings.languagePreference);
        applyDocumentLanguage();
        renderPage();
      });
    });

    control.append(label, select);
    return control;
  }

  function createManagerPanel(): HTMLElement {
    const panel = document.createElement("section");
    panel.className = "options-manager";

    const top = document.createElement("div");
    top.className = "options-manager-top";

    const copy = document.createElement("div");
    const title = document.createElement("h2");
    title.textContent = t("optionsRules");
    const subtitle = document.createElement("p");
    subtitle.textContent = t("optionsRulesSubtitle");
    copy.append(title, subtitle);

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "options-add-button";
    addButton.dataset.optionsAdd = "true";
    addButton.dataset.optionsEditorActivator = "true";
    addButton.textContent = t("optionsAddRule");
    addButton.addEventListener("click", openCreateEditor);

    const actionGroup = document.createElement("div");
    actionGroup.className = "options-manager-actions";

    const guideLink = document.createElement("a");
    guideLink.className = "options-guide-link";
    guideLink.href = "guide.html";
    guideLink.target = "_blank";
    guideLink.rel = "noreferrer";
    guideLink.textContent = t("optionsUserGuide");

    const stylesButton = document.createElement("button");
    stylesButton.type = "button";
    stylesButton.className = "options-style-button";
    stylesButton.dataset.optionsStyles = "true";
    stylesButton.dataset.optionsEditorActivator = "true";
    stylesButton.textContent = t("optionsTagStyles");
    stylesButton.addEventListener("click", openStylesEditor);

    actionGroup.append(guideLink, stylesButton, addButton);
    top.append(copy, actionGroup);
    panel.append(top, createFilterBar(), createBulkActionBar());

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
    search.placeholder = t("optionsSearchPlaceholder");
    search.value = filterText;
    search.dataset.optionsSearch = "true";
    search.addEventListener("input", () => {
      filterText = search.value.toLowerCase();
      renderFilteredRules();
    });

    const actionFilter = document.createElement("select");
    actionFilter.dataset.optionsActionFilter = "true";
    appendOption(actionFilter, "all", t("optionsAllActions"));
    for (const action of ACTIONS) appendOption(actionFilter, action, formatActionLabel(action));
    actionFilter.value = filterAction;
    actionFilter.addEventListener("change", () => {
      filterAction = actionFilter.value as ActionFilter;
      renderFilteredRules();
    });

    const categoryFilter = document.createElement("select");
    categoryFilter.dataset.optionsCategoryFilter = "true";
    appendOption(categoryFilter, "all-categories", t("optionsAllCategories"));
    for (const category of CATEGORIES) appendOption(categoryFilter, category, formatCategory(category));
    categoryFilter.value = filterCategory;
    categoryFilter.addEventListener("change", () => {
      filterCategory = categoryFilter.value as CategoryFilter;
      renderFilteredRules();
    });

    const statusFilter = document.createElement("select");
    statusFilter.dataset.optionsStatusFilter = "true";
    appendOption(statusFilter, "all", t("optionsAllStatus"));
    appendOption(statusFilter, "enabled", t("labelEnabled"));
    appendOption(statusFilter, "disabled", t("labelPaused"));
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
    const currentBulkBar = container.querySelector<HTMLElement>("[data-options-bulk-bar]");
    if (!currentList || !currentEditor) {
      renderPage();
      return;
    }

    const filteredRules = getFilteredRules();
    closeEditorIfSelectionIsFilteredOut(filteredRules);
    syncSelectedRuleIds();

    currentBulkBar?.replaceWith(createBulkActionBar());
    currentList.replaceWith(createRuleList());
    currentEditor.replaceWith(createRuleEditor());
    restoreRuleListScroll();
  }

  function createBulkActionBar(): HTMLElement {
    const bar = document.createElement("div");
    bar.className = selectedRuleIds.size > 0 ? "options-bulk-bar is-active" : "options-bulk-bar";
    bar.dataset.optionsBulkBar = "true";
    if (selectedRuleIds.size === 0) return bar;

    const count = document.createElement("span");
    count.textContent = t("optionsSelectedCount", [selectedRuleIds.size]);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "options-bulk-delete";
    deleteButton.dataset.optionsBulkDelete = "true";
    deleteButton.textContent = t("optionsDeleteSelected");
    deleteButton.addEventListener("click", () => {
      void withStorageErrorHandling(deleteSelectedRules);
    });

    bar.append(count, deleteButton);
    return bar;
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
    header.appendChild(createSelectAllCell(filteredRules));
    for (const label of [
      t("optionsTablePattern"),
      t("optionsTableAction"),
      t("optionsTableMatch"),
      t("optionsTableCategory"),
      t("optionsTableStatus"),
      "",
    ] as const) {
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
    title.textContent = allRules.length === 0 ? t("optionsNoRulesTitle") : t("optionsNoMatchingRulesTitle");

    const copy = document.createElement("p");
    copy.textContent =
      allRules.length === 0
        ? t("optionsNoRulesBody")
        : t("optionsNoMatchingRulesBody");

    const action = document.createElement("button");
    action.type = "button";
    action.className = "options-empty-action";
    action.textContent = allRules.length === 0 ? t("optionsAddRule").replace("+ ", "") : t("optionsClearFilters");
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
      createRuleSelectCell(rule),
      createPatternCell(rule.pattern),
      createBadge("rule-badge", rule.action, formatActionLabel(rule.action)),
      createCell("rule-meta", formatMatchMode(rule.matchMode)),
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

  function createSelectAllCell(filteredRules: readonly Rule[]): HTMLElement {
    const cell = document.createElement("div");
    cell.className = "rule-select-cell";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.optionsSelectAll = "true";
    checkbox.ariaLabel = t("optionsSelectAllRules");
    const selectedVisibleCount = filteredRules.filter((rule) => selectedRuleIds.has(rule.id)).length;
    checkbox.checked = filteredRules.length > 0 && selectedVisibleCount === filteredRules.length;
    checkbox.indeterminate = selectedVisibleCount > 0 && selectedVisibleCount < filteredRules.length;
    checkbox.addEventListener("change", () => {
      rememberRuleListScroll();
      if (checkbox.checked) {
        for (const rule of filteredRules) selectedRuleIds.add(rule.id);
      } else {
        for (const rule of filteredRules) selectedRuleIds.delete(rule.id);
      }
      renderPage();
    });

    cell.appendChild(checkbox);
    return cell;
  }

  function createRuleSelectCell(rule: Rule): HTMLElement {
    const cell = document.createElement("div");
    cell.className = "rule-select-cell";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.ruleSelect = "true";
    checkbox.dataset.ruleId = rule.id;
    checkbox.ariaLabel = t("optionsSelectRule", [rule.pattern]);
    checkbox.checked = selectedRuleIds.has(rule.id);
    checkbox.addEventListener("click", (event) => event.stopPropagation());
    checkbox.addEventListener("change", () => {
      rememberRuleListScroll();
      if (checkbox.checked) {
        selectedRuleIds.add(rule.id);
      } else {
        selectedRuleIds.delete(rule.id);
      }
      renderPage();
    });

    cell.appendChild(checkbox);
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
    if (action !== "hideWork") {
      const style = settings.actionStyles[action];
      badge.style.backgroundColor = style.backgroundColor;
      badge.style.color = style.textColor;
    }
    return badge;
  }

  function createStatusToggle(rule: Rule): HTMLElement {
    const label = document.createElement("label");
    label.className = "rule-toggle";

    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.checked = rule.enabled;
    toggle.title = rule.enabled ? t("optionsDisableRule") : t("optionsEnableRule");
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
    text.textContent = rule.enabled ? t("labelOn") : t("labelPaused");
    label.append(toggle, text);
    return label;
  }

  function createRowActions(rule: Rule): HTMLElement {
    const controls = document.createElement("div");
    controls.className = "rule-actions";

    const edit = createActionButton(t("optionsEdit"), rule, "edit");
    edit.dataset.optionsEditorActivator = "true";
    edit.addEventListener("click", () => openEditEditor(rule.id));

    const remove = createActionButton(t("optionsDelete"), rule, "delete");
    remove.addEventListener("click", () => {
      void withStorageErrorHandling(async () => {
        if (!deps.confirmDelete(rule)) return;
        await deps.deleteRule(rule.id);
        allRules = allRules.filter((candidate) => candidate.id !== rule.id);
        selectedRuleIds.delete(rule.id);
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
    if (editorMode === "styles") return createTagStylesEditor();

    const editor = document.createElement("aside");
    editor.className = editorOpen ? "options-editor is-open" : "options-editor";
    editor.ariaHidden = editorOpen ? "false" : "true";
    editor.dataset.optionsEditor = "true";

    const selectedRule = selectedRuleId ? allRules.find((rule) => rule.id === selectedRuleId) ?? null : null;
    const isEditing = editorMode === "edit" && selectedRule;
    const rule = isEditing ? selectedRule : null;

    const title = document.createElement("h2");
    title.textContent = isEditing && rule ? t("optionsEditingRule", [rule.pattern]) : t("optionsNewRule");

    const mode = document.createElement("p");
    mode.className = "options-editor-mode";
    mode.textContent = isEditing ? t("optionsEditSelectedRule") : t("optionsCreateRule");

    const hint = document.createElement("p");
    hint.className = "options-editor-hint";
    hint.textContent = isEditing
      ? t("optionsEditHint")
      : t("optionsCreateHint");

    const form = document.createElement("form");
    form.dataset.ruleForm = "true";

    form.append(
      createTextField("pattern", t("optionsFieldPattern"), rule?.pattern ?? ""),
      createSelectField("action", t("optionsFieldAction"), ACTIONS, rule?.action ?? "highlight", formatActionLabel),
      createSelectField("matchMode", t("optionsFieldMatchMode"), MATCH_MODES, rule?.matchMode ?? "exact", formatMatchMode),
      createSelectField("category", t("optionsFieldCategory"), CATEGORIES, rule?.category ?? "all", formatCategory),
      createCheckboxField("enabled", t("labelEnabled"), rule?.enabled ?? true)
    );

    const footer = document.createElement("div");
    footer.className = "editor-actions";

    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = isEditing ? t("optionsSave") : t("optionsCreate");

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

  function createTagStylesEditor(): HTMLElement {
    const editor = document.createElement("aside");
    editor.className = "options-editor options-style-editor is-open";
    editor.ariaHidden = "false";
    editor.dataset.optionsEditor = "true";

    const mode = document.createElement("p");
    mode.className = "options-editor-mode";
    mode.textContent = t("optionsTagAppearance");

    const title = document.createElement("h2");
    title.textContent = t("optionsTagStyles");

    const hint = document.createElement("p");
    hint.className = "options-editor-hint";
    hint.textContent = t("optionsTagStylesHint");

    const form = document.createElement("form");
    form.dataset.styleForm = "true";

    const highlightRow = createStyleEditorRow("highlight", settings.actionStyles.highlight);
    const warnRow = createStyleEditorRow("warn", settings.actionStyles.warn);
    form.append(highlightRow, warnRow, createLockedStyleRow());

    const footer = document.createElement("div");
    footer.className = "editor-actions";

    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = t("optionsSave");
    footer.appendChild(submit);
    form.appendChild(footer);

    form.addEventListener("input", () => updateStylePreviews(form));
    form.addEventListener("click", (event) => handleStylePresetClick(event, form));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void withStorageErrorHandling(async () => {
        settings = await deps.saveSettings({ actionStyles: readStyleForm(form) });
        closeEditor();
        renderPage();
      });
    });

    editor.append(mode, title, hint, form);
    return editor;
  }

  function createStyleEditorRow(
    action: CustomizableRuleAction,
    style: RuleActionStyles["highlight"]
  ): HTMLElement {
    const row = document.createElement("section");
    row.className = "style-editor-row";
    row.dataset.styleAction = action;

    const header = document.createElement("div");
    header.className = "style-editor-row-header";

    const title = document.createElement("h3");
    title.textContent = action === "highlight" ? t("actionHighlight") : t("actionWarning");

    const preview = document.createElement("span");
    preview.className = "style-preview";
    preview.dataset.stylePreview = action;
    preview.textContent = getLocalizedCustomizableActionLabel(action, style);
    preview.style.backgroundColor = style.backgroundColor;
    preview.style.color = style.textColor;

    header.append(title, preview);

    const fields = document.createElement("div");
    fields.className = "style-editor-fields";
    fields.append(
      createStyleInput(`${action}Label`, t("optionsStyleLabel"), "text", getLocalizedCustomizableActionLabel(action, style)),
      createStyleInput(`${action}BackgroundColor`, t("optionsStyleBackground"), "color", style.backgroundColor),
      createStyleInput(`${action}TextColor`, t("optionsStyleText"), "color", style.textColor)
    );

    row.append(header, fields);
    row.appendChild(createStylePresetPicker(action));
    return row;
  }

  function createStylePresetPicker(action: CustomizableRuleAction): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.className = "style-preset-picker";

    const label = document.createElement("p");
    label.className = "style-preset-label";
    label.textContent = t("optionsRecommendedPalettes");

    const options = document.createElement("div");
    options.className = "style-preset-options";

    for (const preset of ACTION_STYLE_PRESETS[action]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "style-preset-button";
      button.dataset.stylePresetAction = action;
      button.dataset.backgroundColor = preset.backgroundColor;
      button.dataset.textColor = preset.textColor;
      button.textContent = getLocalizedPresetName(preset.name);
      button.style.backgroundColor = preset.backgroundColor;
      button.style.color = preset.textColor;
      options.appendChild(button);
    }

    wrapper.append(label, options);
    return wrapper;
  }

  function createLockedStyleRow(): HTMLElement {
    const row = document.createElement("section");
    row.className = "style-editor-row style-editor-row-locked";

    const copy = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = t("actionCollapseWork");
    const hint = document.createElement("p");
    hint.textContent = t("optionsCollapseAlwaysFixed");
    copy.append(title, hint);

    const locked = document.createElement("span");
    locked.className = "style-locked-label";
    locked.textContent = t("optionsLocked");

    row.append(copy, locked);
    return row;
  }

  function createStyleInput(
    name: string,
    label: string,
    type: "text" | "color",
    value: string
  ): HTMLElement {
    const wrapper = createFieldWrapper(name, label);
    const input = document.createElement("input");
    input.type = type;
    input.name = name;
    input.value = value;
    input.required = true;
    wrapper.appendChild(input);
    return wrapper;
  }

  async function withStorageErrorHandling(operation: () => Promise<void>): Promise<void> {
    try {
      await operation();
    } catch (error) {
      deps.logError(error);
      deps.alertError(error instanceof Error ? error.message : t("optionsOperationFailed"));
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

  function openStylesEditor(): void {
    rememberRuleListScroll();
    editorMode = "styles";
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

  async function deleteSelectedRules(): Promise<void> {
    const ids = [...selectedRuleIds];
    if (ids.length === 0) return;
    if (!deps.confirmBulkDelete(ids.length)) return;

    await deps.deleteRules(ids);
    const deletedIds = new Set(ids);
    allRules = allRules.filter((rule) => !deletedIds.has(rule.id));
    selectedRuleIds = new Set<string>();
    if (selectedRuleId && deletedIds.has(selectedRuleId)) closeEditor();
    if (allRules.length === 0) closeEditor();
    rememberRuleListScroll();
    renderPage();
  }

  function syncSelectedRuleIds(): void {
    const validRuleIds = new Set(allRules.map((rule) => rule.id));
    selectedRuleIds = new Set([...selectedRuleIds].filter((id) => validRuleIds.has(id)));
  }

  function formatActionLabel(action: RuleAction): string {
    return getLocalizedActionLabel(action, settings.actionStyles);
  }

  function closeEditorOnOutsideClick(event: MouseEvent): void {
    const target = event.target;
    if (!editorOpen || !(target instanceof Element)) return;
    if (
      target.closest("[data-options-editor]") ||
      target.closest("[data-options-rule-list]") ||
      target.closest("[data-options-editor-activator]") ||
      target.closest("[data-options-sidebar-control]")
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

function readStyleForm(form: HTMLFormElement): RuleActionStyles {
  const formData = new FormData(form);
  return {
    highlight: {
      label: String(formData.get("highlightLabel") ?? ""),
      backgroundColor: String(formData.get("highlightBackgroundColor") ?? ""),
      textColor: String(formData.get("highlightTextColor") ?? ""),
    },
    warn: {
      label: String(formData.get("warnLabel") ?? ""),
      backgroundColor: String(formData.get("warnBackgroundColor") ?? ""),
      textColor: String(formData.get("warnTextColor") ?? ""),
    },
  };
}

function updateStylePreviews(form: HTMLFormElement): void {
  const styles = readStyleForm(form);
  updateStylePreview(form, "highlight", styles.highlight);
  updateStylePreview(form, "warn", styles.warn);
}

function handleStylePresetClick(event: Event, form: HTMLFormElement): void {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const button = target.closest<HTMLButtonElement>("[data-style-preset-action]");
  if (!button) return;

  const action = button.dataset.stylePresetAction;
  if (action !== "highlight" && action !== "warn") return;

  const backgroundInput = form.querySelector<HTMLInputElement>(
    `[name="${action}BackgroundColor"]`
  );
  const textInput = form.querySelector<HTMLInputElement>(`[name="${action}TextColor"]`);
  if (!backgroundInput || !textInput) return;

  backgroundInput.value = button.dataset.backgroundColor ?? backgroundInput.value;
  textInput.value = button.dataset.textColor ?? textInput.value;
  updateStylePreviews(form);
}

function updateStylePreview(
  form: HTMLFormElement,
  action: "highlight" | "warn",
  style: RuleActionStyles["highlight"]
): void {
  const preview = form.querySelector<HTMLElement>(`[data-style-preview="${action}"]`);
  if (!preview) return;

  preview.textContent = style.label;
  preview.style.backgroundColor = style.backgroundColor;
  preview.style.color = style.textColor;
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

function formatCategory(category: TagCategory): string {
  if (category === "all") return t("categoryAny");
  if (category === "relationship") return t("categoryRelationship");
  if (category === "character") return t("categoryCharacter");
  return t("categoryFreeform");
}

function formatMatchMode(matchMode: MatchMode): string {
  if (matchMode === "exact") return t("labelExact");
  if (matchMode === "contains") return t("labelContains");
  return t("labelWildcard");
}

function createRealDeps(): OptionsAppDeps {
  return {
    listRules: defaultListRules,
    addRule: defaultAddRule,
    updateRule: defaultUpdateRule,
    deleteRule: defaultDeleteRule,
    deleteRules: defaultDeleteRules,
    toggleRule: defaultToggleRule,
    getSettings: defaultGetSettings,
    saveSettings: defaultSaveSettings,
    confirmDelete: (rule) => window.confirm(t("optionsDeleteConfirm", [rule.pattern])),
    confirmBulkDelete: (count) => window.confirm(t("optionsBulkDeleteConfirm", [count])),
    alertError: (message) => window.alert(message),
    logError: (error) => {
      console.error(`${LOG_PREFIX} Options error:`, error);
    },
  };
}
