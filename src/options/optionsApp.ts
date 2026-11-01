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
import { AO3_HOST, getCustomHosts, parseCustomHostInput, toCustomOriginPattern } from "../shared/customHosts";
import { getExtensionApi } from "../shared/extensionApi";
import { formatRuleSaveError } from "../shared/ruleError";
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
type SiteMessage = { tone: "success" | "error"; text: string };

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
  confirmRemoveSites(hosts: readonly string[]): boolean;
  alertError(message: string): void;
  listCustomHosts(): Promise<string[]>;
  requestCustomHost(host: string): Promise<boolean>;
  removeCustomHosts(hosts: readonly string[]): Promise<boolean>;
  addCustomHostsListener(callback: () => void): void;
  logError(error: unknown): void;
}

interface ChromeLike {
  permissions?: {
    getAll(): Promise<{ origins?: string[] }>;
    request(permissions: { origins: string[] }): Promise<boolean>;
    remove(permissions: { origins: string[] }): Promise<boolean>;
    onAdded?: { addListener(callback: () => void): void };
    onRemoved?: { addListener(callback: () => void): void };
  };
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
  let customHosts = await listCustomHostsSafely();
  let filterText = "";
  let filterAction: ActionFilter = "all";
  let filterCategory: CategoryFilter = "all-categories";
  let filterStatus: StatusFilter = "all";
  let editorMode: EditorMode = "create";
  let selectedRuleId: string | null = null;
  let selectedRuleIds = new Set<string>();
  let editorOpen = false;
  let ruleListScrollTop = 0;
  const ruleDrafts = new Map<string, RuleCreateInput>();
  let storagePending = false;
  let storageError = "";
  const disabledControls = new Map<HTMLInputElement | HTMLSelectElement | HTMLButtonElement, boolean>();
  let sitesOpen = false;
  let siteFilterText = "";
  let selectedHosts = new Set<string>();
  let siteEditorOpen = false;
  let editingHost: string | null = null;
  let siteDraft = "";
  // Page-level results (removals, saved edits) vs. form feedback shown beside the input.
  let siteMessage: SiteMessage | null = null;
  let siteFormMessage: SiteMessage | null = null;
  let sitePending = false;

  setLanguagePreference(settings.languagePreference);
  applyDocumentLanguage();
  container.addEventListener("click", closeEditorOnOutsideClick);
  deps.addCustomHostsListener(() => {
    // Picks up access granted or revoked from the browser's own extension settings.
    void listCustomHostsSafely().then((hosts) => {
      if (sitePending || hosts.join("\n") === customHosts.join("\n")) return;
      customHosts = hosts;
      if (sitesOpen) renderPage();
    });
  });
  renderPage();

  function renderPage(): void {
    syncSelectedRuleIds();
    syncSiteState();
    container.textContent = "";

    const shell = document.createElement("main");
    shell.className = "options-shell";
    shell.dataset.optionsShell = "true";

    const workspace = document.createElement("section");
    workspace.className = "options-workspace";
    workspace.append(createSidebar(), sitesOpen ? createSitesPage() : createManagerPanel());
    shell.appendChild(workspace);

    const errorNotice = document.createElement("p");
    errorNotice.dataset.optionsError = "true";
    errorNotice.id = "options-storage-error";
    errorNotice.setAttribute("role", "alert");
    errorNotice.textContent = storageError;
    errorNotice.hidden = !storageError;
    shell.prepend(errorNotice);
    container.appendChild(shell);
    syncStoragePending();
    restoreRuleListScroll();
  }

  function createSidebar(): HTMLElement {
    const sidebar = document.createElement("aside");
    sidebar.className = "options-sidebar";

    const brand = document.createElement("div");
    brand.className = "options-brand";
    const brandName = document.createElement("strong");
    brandName.append("AO3 Tag", document.createElement("br"), "Highlighter");
    brand.appendChild(brandName);

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
      item.className = !sitesOpen && status === filterStatus ? "options-nav-item is-active" : "options-nav-item";
      item.dataset.sidebarStatusFilter = status;
      const itemLabel = document.createElement("span");
      itemLabel.textContent = label;
      const itemValue = document.createElement("strong");
      itemValue.textContent = value;
      item.append(itemLabel, itemValue);
      item.addEventListener("click", () => {
        rememberRuleListScroll();
        sitesOpen = false;
        filterStatus = status;
        closeEditorIfSelectionIsFilteredOut();
        renderPage();
      });
      nav.appendChild(item);
    }

    const sitesButton = document.createElement("button");
    sitesButton.type = "button";
    sitesButton.className = sitesOpen ? "options-nav-item is-active" : "options-nav-item";
    sitesButton.dataset.optionsSites = "true";
    sitesButton.dataset.optionsEditorActivator = "true";
    sitesButton.textContent = t("optionsSites");
    if (sitesOpen) sitesButton.setAttribute("aria-current", "page");
    sitesButton.setAttribute("aria-controls", "options-sites-page");
    sitesButton.addEventListener("click", openSitesPage);
    nav.appendChild(sitesButton);

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
    const title = document.createElement("h1");
    title.textContent = t("optionsRules");
    copy.appendChild(title);

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
    const draftKey = rule?.id ?? "create";
    const draft = ruleDrafts.get(draftKey) ?? rule;

    const title = document.createElement("h2");
    title.textContent = isEditing && rule ? t("optionsEditingRule", [rule.pattern]) : t("optionsNewRule");

    const form = document.createElement("form");
    form.dataset.ruleForm = "true";
    form.setAttribute("aria-describedby", "options-storage-error");

    form.append(
      createTextField("pattern", t("optionsFieldPattern"), draft?.pattern ?? ""),
      createSelectField("action", t("optionsFieldAction"), ACTIONS, draft?.action ?? "highlight", formatActionLabel),
      createSelectField("matchMode", t("optionsFieldMatchMode"), MATCH_MODES, draft?.matchMode ?? "exact", formatMatchMode),
      createSelectField("category", t("optionsFieldCategory"), CATEGORIES, draft?.category ?? "all", formatCategory),
      createCheckboxField("enabled", t("labelEnabled"), draft?.enabled ?? true)
    );

    const footer = document.createElement("div");
    footer.className = "editor-actions";

    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = isEditing ? t("optionsSave") : t("optionsCreate");

    footer.appendChild(submit);
    form.appendChild(footer);

    const saveDraft = (): void => { ruleDrafts.set(draftKey, readRuleForm(form)); };
    form.addEventListener("input", saveDraft);
    form.addEventListener("change", saveDraft);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (storagePending) return;
      saveDraft();
      const input = readRuleForm(form);
      void withStorageErrorHandling(async () => {

        if (isEditing && rule) {
          const updated = await deps.updateRule(rule.id, input);
          replaceRule(updated);
        } else {
          const created = await deps.addRule({ ...input, source: "manual" });
          allRules = [...allRules, created];
        }

        ruleDrafts.delete(draftKey);
        closeEditor();
        renderPage();
      }, true);
    });

    editor.append(title, form);
    return editor;
  }

  function createTagStylesEditor(): HTMLElement {
    const editor = document.createElement("aside");
    editor.className = "options-editor options-style-editor is-open";
    editor.ariaHidden = "false";
    editor.dataset.optionsEditor = "true";

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

    editor.append(title, hint, form);
    return editor;
  }

  function createSitesPage(): HTMLElement {
    const page = document.createElement("section");
    page.className = "options-manager options-sites-page";
    page.dataset.optionsSitesPage = "true";
    page.id = "options-sites-page";

    const top = document.createElement("div");
    top.className = "options-manager-top";

    const copy = document.createElement("div");
    const title = document.createElement("h1");
    title.textContent = t("optionsSites");
    copy.appendChild(title);

    const addButton = document.createElement("button");
    addButton.type = "button";
    addButton.className = "options-add-button";
    addButton.dataset.optionsSiteAdd = "true";
    addButton.dataset.optionsEditorActivator = "true";
    addButton.textContent = t("optionsAddSite");
    addButton.addEventListener("click", openSiteCreateEditor);

    const actionGroup = document.createElement("div");
    actionGroup.className = "options-manager-actions";
    actionGroup.appendChild(addButton);
    top.append(copy, actionGroup);

    const toolbar = document.createElement("div");
    toolbar.className = "options-toolbar options-site-toolbar";
    const search = document.createElement("input");
    search.type = "search";
    search.placeholder = t("optionsSiteSearchPlaceholder");
    search.value = siteFilterText;
    search.dataset.optionsSiteSearch = "true";
    search.addEventListener("input", () => {
      siteFilterText = search.value.trim().toLowerCase();
      renderFilteredSites();
    });
    toolbar.appendChild(search);

    const pageMessage = createSiteMessage(siteMessage);
    pageMessage.dataset.sitesMessage = "true";

    const content = document.createElement("div");
    content.className = siteEditorOpen ? "options-content-grid has-editor" : "options-content-grid";
    content.append(createSiteList(), createSiteEditor());

    page.append(top, toolbar, createSiteBulkBar(), pageMessage, content);
    return page;
  }

  function renderFilteredSites(): void {
    if (siteEditorOpen && editingHost && !getFilteredHosts().includes(editingHost)) {
      // Same as rules: an edited item that leaves the filtered list closes the editor.
      closeSiteEditor();
      renderPage();
      const search = container.querySelector<HTMLInputElement>("[data-options-site-search]");
      search?.focus();
      search?.setSelectionRange(search.value.length, search.value.length);
      return;
    }
    container.querySelector("[data-options-site-bulk-bar]")?.replaceWith(createSiteBulkBar());
    container.querySelector("[data-options-site-list]")?.replaceWith(createSiteList());
  }

  function getFilteredHosts(): string[] {
    return [AO3_HOST, ...customHosts].filter((host) => host.includes(siteFilterText));
  }

  function createSiteBulkBar(): HTMLElement {
    const bar = document.createElement("div");
    bar.className = selectedHosts.size > 0 ? "options-bulk-bar is-active" : "options-bulk-bar";
    bar.dataset.optionsSiteBulkBar = "true";
    if (selectedHosts.size === 0) return bar;

    const count = document.createElement("span");
    count.textContent = t("optionsSitesSelectedCount", [selectedHosts.size]);

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "options-bulk-delete";
    removeButton.dataset.optionsSiteBulkRemove = "true";
    removeButton.textContent = t("optionsRemoveSelected");
    removeButton.addEventListener("click", () => removeSites([...selectedHosts]));

    bar.append(count, removeButton);
    return bar;
  }

  function createSiteList(): HTMLElement {
    const list = document.createElement("section");
    list.className = "options-rule-list options-site-list";
    list.dataset.optionsSiteList = "true";

    const hosts = getFilteredHosts();
    if (hosts.length === 0) {
      list.appendChild(createSiteEmptyState());
      return list;
    }

    const header = document.createElement("div");
    header.className = "options-table-header";
    header.appendChild(createSiteSelectAllCell(hosts.filter((host) => host !== AO3_HOST)));
    for (const label of [t("optionsSiteField"), ""]) {
      const cell = document.createElement("span");
      cell.textContent = label;
      header.appendChild(cell);
    }
    list.appendChild(header);

    for (const host of hosts) list.appendChild(host === AO3_HOST ? createDefaultSiteRow() : createSiteRow(host));
    return list;
  }

  function createSiteEmptyState(): HTMLElement {
    const empty = document.createElement("div");
    empty.className = "options-empty";

    const title = document.createElement("h3");
    title.textContent = t("optionsNoMatchingSitesTitle");
    const copy = document.createElement("p");
    copy.textContent = t("optionsNoMatchingSitesBody");

    const action = document.createElement("button");
    action.type = "button";
    action.className = "options-empty-action";
    action.textContent = t("optionsClearSearch");
    action.addEventListener("click", () => {
      siteFilterText = "";
      renderPage();
    });

    empty.append(title, copy, action);
    return empty;
  }

  function createSiteSelectAllCell(visibleHosts: readonly string[]): HTMLElement {
    const cell = document.createElement("div");
    cell.className = "rule-select-cell";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.optionsSiteSelectAll = "true";
    checkbox.ariaLabel = t("optionsSelectAllSites");
    const selectedVisibleCount = visibleHosts.filter((host) => selectedHosts.has(host)).length;
    checkbox.checked = visibleHosts.length > 0 && selectedVisibleCount === visibleHosts.length;
    checkbox.indeterminate = selectedVisibleCount > 0 && selectedVisibleCount < visibleHosts.length;
    checkbox.disabled = visibleHosts.length === 0;
    checkbox.addEventListener("change", () => {
      for (const host of visibleHosts) {
        if (checkbox.checked) selectedHosts.add(host);
        else selectedHosts.delete(host);
      }
      renderPage();
    });

    cell.appendChild(checkbox);
    return cell;
  }

  function createDefaultSiteRow(): HTMLElement {
    const row = document.createElement("article");
    row.className = "options-rule-row options-site-row is-locked";
    row.dataset.siteHost = AO3_HOST;

    const label = document.createElement("span");
    label.className = "style-locked-label";
    label.textContent = t("optionsSiteDefault");
    const actions = document.createElement("div");
    actions.className = "rule-actions";
    actions.appendChild(label);

    row.append(document.createElement("div"), createSiteHostCell(AO3_HOST), actions);
    return row;
  }

  function createSiteRow(host: string): HTMLElement {
    const row = document.createElement("article");
    row.className = `options-rule-row options-site-row${host === editingHost ? " is-selected" : ""}`;
    row.dataset.siteHost = host;

    const selectCell = document.createElement("div");
    selectCell.className = "rule-select-cell";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.siteSelect = host;
    checkbox.ariaLabel = t("optionsSelectSite", [host]);
    checkbox.checked = selectedHosts.has(host);
    checkbox.addEventListener("click", (event) => event.stopPropagation());
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) selectedHosts.add(host);
      else selectedHosts.delete(host);
      renderPage();
    });
    selectCell.appendChild(checkbox);

    const edit = document.createElement("button");
    edit.type = "button";
    edit.dataset.siteEdit = host;
    edit.dataset.optionsEditorActivator = "true";
    edit.textContent = t("optionsEdit");
    edit.addEventListener("click", () => openSiteEditEditor(host));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.dataset.siteRemove = host;
    remove.textContent = t("optionsSiteRemove");
    remove.addEventListener("click", () => removeSites([host]));

    const actions = document.createElement("div");
    actions.className = "rule-actions";
    actions.append(edit, remove);

    row.append(selectCell, createSiteHostCell(host), actions);
    row.addEventListener("click", (event) => {
      const target = event.target;
      if (target instanceof HTMLButtonElement || target instanceof HTMLInputElement) return;
      openSiteEditEditor(host);
    });
    return row;
  }

  function createSiteHostCell(host: string): HTMLElement {
    const cell = createCell("rule-pattern sites-host", host);
    cell.title = host;
    return cell;
  }

  function createSiteEditor(): HTMLElement {
    const editor = document.createElement("aside");
    editor.className = siteEditorOpen ? "options-editor is-open" : "options-editor";
    editor.ariaHidden = siteEditorOpen ? "false" : "true";
    editor.dataset.optionsSiteEditor = "true";

    const title = document.createElement("h2");
    title.textContent = editingHost ? t("optionsSiteEditing", [editingHost]) : t("optionsNewSite");

    const hint = document.createElement("p");
    hint.className = "options-editor-hint";
    hint.textContent = t("optionsSitesHint");

    const form = document.createElement("form");
    form.dataset.siteForm = "true";
    form.noValidate = true;

    const field = createFieldWrapper("host", t("optionsSiteField"));
    const input = document.createElement("input");
    input.type = "text";
    input.name = "host";
    input.id = "host";
    input.value = siteDraft;
    input.autocomplete = "off";
    input.spellcheck = false;
    input.setAttribute("autocapitalize", "off");
    input.setAttribute("aria-describedby", "options-site-form-message");
    input.addEventListener("input", () => {
      siteDraft = input.value;
    });
    field.appendChild(input);

    const footer = document.createElement("div");
    footer.className = "editor-actions";
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.textContent = editingHost ? t("optionsSave") : t("optionsSiteEnable");
    footer.appendChild(submit);
    form.append(field, footer);

    const formMessage = createSiteMessage(siteFormMessage);
    formMessage.id = "options-site-form-message";
    formMessage.dataset.siteFormMessage = "true";

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (sitePending) return;
      siteDraft = input.value;
      const parsed = parseCustomHostInput(input.value);
      if (!parsed.ok) {
        showSiteFormMessage({ tone: "error", text: getSiteInputError(parsed.reason) });
        return;
      }
      if (parsed.host === editingHost) {
        closeSiteEditor();
        renderPage();
        return;
      }
      if (customHosts.includes(parsed.host)) {
        showSiteFormMessage({ tone: "error", text: t("optionsSiteDuplicate", [parsed.host]) });
        return;
      }

      // Firefox only allows permission requests inside the user gesture, so call before any await.
      const previousHost = editingHost;
      const request = deps.requestCustomHost(parsed.host);
      void runSiteChange((async () => {
        try {
          if (!await request) {
            siteFormMessage = { tone: "error", text: t("optionsSiteDenied") };
            return;
          }
        } catch (error) {
          deps.logError(error);
          siteFormMessage = { tone: "error", text: t("optionsSiteFailed") };
          return;
        }

        let replacementIncomplete = false;
        if (previousHost) {
          // Keep the original grant until the replacement has been approved.
          try {
            replacementIncomplete = !await deps.removeCustomHosts([previousHost]);
          } catch (error) {
            deps.logError(error);
            replacementIncomplete = true;
          }
        }
        closeSiteEditor();
        siteMessage = replacementIncomplete && previousHost
          ? { tone: "error", text: t("optionsSiteReplacePartial", [parsed.host, previousHost]) }
          : { tone: "success", text: t("optionsSiteEnabled", [parsed.host]) };
      })());
    });

    const note = document.createElement("p");
    note.className = "options-editor-hint sites-note";
    note.textContent = t("optionsSitesTrustNote");

    editor.append(title, hint, form, formMessage, note);
    return editor;
  }

  function createSiteMessage(message: SiteMessage | null): HTMLElement {
    const notice = document.createElement("p");
    notice.className = message ? `sites-message is-${message.tone}` : "sites-message";
    notice.setAttribute("role", "status");
    notice.textContent = message?.text ?? "";
    notice.hidden = !message;
    return notice;
  }

  function removeSites(hosts: readonly string[]): void {
    if (sitePending || hosts.length === 0 || !deps.confirmRemoveSites(hosts)) return;
    // Start the permission change inside the user gesture, before any await.
    const removal = deps.removeCustomHosts(hosts);
    void runSiteChange((async () => {
      siteFormMessage = null;
      try {
        if (!await removal) {
          siteMessage = { tone: "error", text: t("optionsSiteFailed") };
          return;
        }
      } catch (error) {
        deps.logError(error);
        siteMessage = { tone: "error", text: t("optionsSiteFailed") };
        return;
      }
      for (const host of hosts) selectedHosts.delete(host);
      if (editingHost && hosts.includes(editingHost)) closeSiteEditor();
      siteMessage = {
        tone: "success",
        text: hosts.length === 1 ? t("optionsSiteRemoved", [hosts[0]]) : t("optionsSitesRemoved", [hosts.length]),
      };
    })());
  }

  async function runSiteChange(change: Promise<void>): Promise<void> {
    sitePending = true;
    const page = container.querySelector<HTMLElement>("[data-options-sites-page]");
    page?.setAttribute("aria-busy", "true");
    for (const control of page?.querySelectorAll<HTMLButtonElement | HTMLInputElement>("button, input") ?? []) {
      control.disabled = true;
    }

    await change;
    customHosts = await listCustomHostsSafely();
    sitePending = false;
    // syncSiteState closes the editor if the edited site is gone, wherever it was removed.
    renderPage();
  }

  function showSiteFormMessage(message: SiteMessage): void {
    siteFormMessage = message;
    const notice = container.querySelector<HTMLElement>("[data-site-form-message]");
    if (!notice) return;
    notice.className = `sites-message is-${message.tone}`;
    notice.textContent = message.text;
    notice.hidden = false;
  }

  function syncSiteState(): void {
    selectedHosts = new Set([...selectedHosts].filter((host) => customHosts.includes(host)));
    if (editingHost && !customHosts.includes(editingHost)) closeSiteEditor();
  }

  function openSiteCreateEditor(): void {
    if (sitePending) return;
    if (editingHost) siteDraft = "";
    editingHost = null;
    siteEditorOpen = true;
    siteMessage = null;
    siteFormMessage = null;
    renderPage();
    container.querySelector<HTMLInputElement>("[data-site-form] input")?.focus();
  }

  function openSiteEditEditor(host: string): void {
    if (sitePending) return;
    editingHost = host;
    siteDraft = host;
    siteEditorOpen = true;
    siteMessage = null;
    siteFormMessage = null;
    renderPage();
    container.querySelector<HTMLInputElement>("[data-site-form] input")?.focus();
  }

  function closeSiteEditor(): void {
    siteEditorOpen = false;
    editingHost = null;
    siteDraft = "";
    siteFormMessage = null;
  }

  async function listCustomHostsSafely(): Promise<string[]> {
    try {
      return await deps.listCustomHosts();
    } catch (error) {
      deps.logError(error);
      return [];
    }
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

  function syncStoragePending(): void {
    container.setAttribute("aria-busy", String(storagePending));
    if (storagePending) {
      for (const control of container.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>("input, select, button")) {
        if (!disabledControls.has(control)) disabledControls.set(control, control.disabled);
        control.disabled = true;
      }
    } else {
      for (const [control, disabled] of disabledControls) control.disabled = disabled;
      disabledControls.clear();
    }
  }

  async function withStorageErrorHandling(operation: () => Promise<void>, isRuleSave = false): Promise<void> {
    if (storagePending) return;
    storagePending = true;
    storageError = "";
    const notice = container.querySelector<HTMLElement>("[data-options-error]");
    if (notice) { notice.textContent = ""; notice.hidden = true; }
    try {
      const pending = operation();
      syncStoragePending();
      await pending;
    } catch (error) {
      deps.logError(error);
      storageError = isRuleSave ? formatRuleSaveError(error) : t("optionsOperationFailed");
      if (!isRuleSave) deps.alertError(error instanceof Error ? error.message : t("optionsOperationFailed"));
      if (notice) { notice.textContent = storageError; notice.hidden = false; }
      if (!isRuleSave && editorMode !== "styles") renderPage();
    } finally {
      storagePending = false;
      syncStoragePending();
      if (isRuleSave && storageError) container.querySelector<HTMLButtonElement>("[data-rule-form] [type=submit]")?.focus();
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

  function openSitesPage(): void {
    rememberRuleListScroll();
    if (!sitesOpen) closeSiteEditor();
    sitesOpen = true;
    siteMessage = null;
    renderPage();
  }

  function openEditEditor(ruleId: string): void {
    if (storagePending) return;
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
    for (const key of ruleDrafts.keys()) {
      if (key !== "create" && !validRuleIds.has(key)) ruleDrafts.delete(key);
    }
    selectedRuleIds = new Set([...selectedRuleIds].filter((id) => validRuleIds.has(id)));
  }

  function formatActionLabel(action: RuleAction): string {
    return getLocalizedActionLabel(action, settings.actionStyles);
  }

  function closeEditorOnOutsideClick(event: MouseEvent): void {
    const target = event.target;
    if (sitesOpen) {
      closeSiteEditorOnOutsideClick(target);
      return;
    }
    if (storagePending || !editorOpen || !(target instanceof Element)) return;
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

  function closeSiteEditorOnOutsideClick(target: EventTarget | null): void {
    if (sitePending || !siteEditorOpen || !(target instanceof Element)) return;
    if (
      target.closest("[data-options-site-editor]") ||
      target.closest("[data-options-site-list]") ||
      target.closest("[data-options-editor-activator]") ||
      target.closest("[data-options-sidebar-control]")
    ) {
      return;
    }

    closeSiteEditor();
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

function getSiteInputError(reason: "empty" | "invalid" | "ao3"): string {
  if (reason === "empty") return t("optionsSiteEmpty");
  if (reason === "ao3") return t("optionsSiteIsAo3");
  return t("optionsSiteInvalid");
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
    confirmRemoveSites: (hosts) => window.confirm(hosts.length === 1
      ? t("optionsSiteRemoveConfirm", [hosts[0]])
      : t("optionsSitesBulkRemoveConfirm", [hosts.length])),
    alertError: (message) => window.alert(message),
    listCustomHosts: async () => {
      const permissionsApi = getExtensionApi<ChromeLike>().permissions;
      if (!permissionsApi) return [];
      return getCustomHosts((await permissionsApi.getAll()).origins ?? []);
    },
    requestCustomHost: async (host) => {
      const permissionsApi = getExtensionApi<ChromeLike>().permissions;
      if (!permissionsApi) return false;
      return permissionsApi.request({ origins: [toCustomOriginPattern(host)] });
    },
    removeCustomHosts: async (hosts) => {
      const permissionsApi = getExtensionApi<ChromeLike>().permissions;
      if (!permissionsApi) return false;
      return permissionsApi.remove({ origins: hosts.map(toCustomOriginPattern) });
    },
    addCustomHostsListener: (callback) => {
      const permissionsApi = getExtensionApi<ChromeLike>().permissions;
      permissionsApi?.onAdded?.addListener(callback);
      permissionsApi?.onRemoved?.addListener(callback);
    },
    logError: (error) => {
      console.error(`${LOG_PREFIX} Options error:`, error);
    },
  };
}
