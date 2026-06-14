import type { MatchMode, Rule, RuleAction, Settings, TagCategory } from "../core/types";
import { DEFAULT_SETTINGS } from "../storage/settingsStorage";
import { renderOptionsApp, type OptionsAppDeps } from "./optionsApp";

describe("renderOptionsApp", () => {
  it("loads and renders existing rules", async () => {
    const container = document.createElement("div");

    await renderOptionsApp(container, createDeps());

    expect(container.textContent).toContain("Slow Burn");
    expect(container.textContent).toContain("Highlight");
    expect(container.textContent).not.toContain("Used by extension pages and AO3 messages.");
    expect(container.querySelector<HTMLAnchorElement>(".options-guide-link")?.getAttribute("href")).toBe(
      "guide.html"
    );
    expect(container.querySelectorAll("[data-rule-row]")).toHaveLength(2);
    expect(getContentGrid(container).className).not.toContain("has-editor");
  });

  it("saves the interface language preference from the sidebar", async () => {
    const container = document.createElement("div");
    const saveSettings = vi.fn(async (patch: Partial<Settings>) => ({ ...DEFAULT_SETTINGS, ...patch }));

    await renderOptionsApp(container, createDeps({ saveSettings }));
    const language = getSelect(container, "[data-options-language]");
    language.value = "zh_CN";
    language.dispatchEvent(new Event("change"));
    await flushAsyncHandlers();

    expect(saveSettings).toHaveBeenCalledWith({ languagePreference: "zh_CN" });
    expect(document.documentElement.lang).toBe("zh-CN");
    expect(container.textContent).toContain("规则管理");
    expect(container.textContent).not.toContain("用于扩展页面和 AO3 页面提示。");
    expect(getSelect(container, "[data-options-language]").value).toBe("zh_CN");
  });

  it("renders an empty state when there are no rules", async () => {
    const container = document.createElement("div");

    await renderOptionsApp(container, createDeps({ listRules: vi.fn(async () => []) }));

    expect(container.textContent).toContain("No rules yet");
  });

  it("filters rules by pattern text", async () => {
    const container = document.createElement("div");

    await renderOptionsApp(container, createDeps());
    const search = getInput(container, "[data-options-search]");
    search.value = "angst";
    search.dispatchEvent(new Event("input"));

    expect(container.textContent).not.toContain("Slow Burn");
    expect(container.textContent).toContain("Angst");
  });

  it("keeps the search input mounted while filtering", async () => {
    const container = document.createElement("div");

    await renderOptionsApp(container, createDeps());
    const search = getInput(container, "[data-options-search]");
    search.value = "a";
    search.dispatchEvent(new Event("input"));

    expect(container.querySelector("[data-options-search]")).toBe(search);
  });

  it("filters rules by action", async () => {
    const container = document.createElement("div");

    await renderOptionsApp(container, createDeps());
    const filter = getSelect(container, "[data-options-action-filter]");
    filter.value = "warn";
    filter.dispatchEvent(new Event("change"));

    expect(container.textContent).not.toContain("Slow Burn");
    expect(container.textContent).toContain("Angst");
  });

  it("filters rules from the sidebar status shortcuts", async () => {
    const container = document.createElement("div");

    await renderOptionsApp(container, createDeps());
    getButton(container, '[data-sidebar-status-filter="disabled"]').click();

    expect(container.textContent).not.toContain("Slow Burn");
    expect(container.textContent).toContain("Angst");
  });

  it("clears filters from the no-results empty state", async () => {
    const container = document.createElement("div");

    await renderOptionsApp(container, createDeps());
    const search = getInput(container, "[data-options-search]");
    search.value = "missing tag";
    search.dispatchEvent(new Event("input"));

    expect(container.textContent).toContain("No matching rules");
    getButton(container, ".options-empty-action").click();

    expect(getInput(container, "[data-options-search]").value).toBe("");
    expect(container.querySelectorAll("[data-rule-row]")).toHaveLength(2);
  });

  it("opens the editor when a rule row is selected", async () => {
    const container = document.createElement("div");

    await renderOptionsApp(container, createDeps());
    container.querySelector<HTMLElement>('[data-rule-row][data-rule-id="rule-2"]')?.click();

    expect(getContentGrid(container).className).toContain("has-editor");
    expect(getEditor(container).className).toContain("is-open");
    expect(container.textContent).toContain("Editing “Angst”");
  });

  it("keeps the rule list scroll position when opening the editor", async () => {
    const container = document.createElement("div");

    await renderOptionsApp(container, createDeps());
    getRuleList(container).scrollTop = 220;
    container.querySelector<HTMLElement>('[data-rule-row][data-rule-id="rule-2"]')?.click();

    expect(getRuleList(container).scrollTop).toBe(220);
    expect(container.textContent).toContain("Editing “Angst”");
  });

  it("opens the editor for add mode without showing a cancel action", async () => {
    const container = document.createElement("div");

    await renderOptionsApp(container, createDeps());
    getButton(container, "[data-options-add]").click();

    expect(getContentGrid(container).className).toContain("has-editor");
    expect(getEditor(container).className).toContain("is-open");
    expect(container.textContent).toContain("New rule");
    expect(container.textContent).not.toContain("Cancel");
  });

  it("opens and saves global tag styles from the drawer", async () => {
    const container = document.createElement("div");
    const saveSettings = vi.fn(async (patch) => ({ ...DEFAULT_SETTINGS, ...patch }));

    await renderOptionsApp(container, createDeps({ saveSettings }));
    getButton(container, "[data-options-styles]").click();

    expect(getContentGrid(container).className).toContain("has-editor");
    expect(getEditor(container).className).toContain("is-open");
    expect(container.textContent).toContain("Tag styles");

    getInput(container, '[name="highlightLabel"]').value = "Like";
    getInput(container, '[name="highlightBackgroundColor"]').value = "#fff4d8";
    getInput(container, '[name="highlightTextColor"]').value = "#5f3b00";
    getInput(container, '[name="warnLabel"]').value = "Avoid";
    getInput(container, '[name="warnBackgroundColor"]').value = "#f4e6e3";
    getInput(container, '[name="warnTextColor"]').value = "#990000";
    getStyleForm(container).dispatchEvent(new SubmitEvent("submit"));
    await flushAsyncHandlers();

    expect(saveSettings).toHaveBeenCalledWith({
      actionStyles: {
        highlight: {
          label: "Like",
          backgroundColor: "#fff4d8",
          textColor: "#5f3b00",
        },
        warn: {
          label: "Avoid",
          backgroundColor: "#f4e6e3",
          textColor: "#990000",
        },
      },
    });
    expect(getContentGrid(container).className).not.toContain("has-editor");
  });

  it("fills color inputs and updates the preview when a recommended palette is selected", async () => {
    const container = document.createElement("div");

    await renderOptionsApp(container, createDeps());
    getButton(container, "[data-options-styles]").click();

    getButton(container, '[data-style-preset-action="highlight"][data-background-color="#e7f4ec"]').click();

    expect(getInput(container, '[name="highlightBackgroundColor"]').value).toBe("#e7f4ec");
    expect(getInput(container, '[name="highlightTextColor"]').value).toBe("#14532d");
    expect(getStylePreview(container, "highlight").style.backgroundColor).toBe("rgb(231, 244, 236)");
    expect(getStylePreview(container, "highlight").style.color).toBe("rgb(20, 83, 45)");
  });

  it("closes the editor when clicking outside the list and editor", async () => {
    const container = document.createElement("div");

    await renderOptionsApp(container, createDeps());
    getButton(container, "[data-options-add]").click();
    expect(getContentGrid(container).className).toContain("has-editor");

    getInput(container, "[data-options-search]").click();

    expect(getContentGrid(container).className).not.toContain("has-editor");
    expect(getEditor(container).className).not.toContain("is-open");
  });

  it("keeps full pattern text available as a native tooltip", async () => {
    const container = document.createElement("div");
    const longPattern = "This is a very long AO3 tag pattern that should be truncated in the list";

    await renderOptionsApp(
      container,
      createDeps({ listRules: vi.fn(async () => [createRule({ pattern: longPattern })]) })
    );

    expect(container.querySelector<HTMLElement>(".rule-pattern")?.title).toBe(longPattern);
  });

  it("adds a new rule from the form", async () => {
    const container = document.createElement("div");
    const createdRule = createRule({ id: "rule-3", pattern: "Fluff", action: "warn" });
    const addRule = vi.fn(async () => createdRule);

    await renderOptionsApp(container, createDeps({ addRule }));
    getButton(container, "[data-options-add]").click();
    getInput(container, '[name="pattern"]').value = "Fluff";
    getSelect(container, '[name="action"]').value = "warn";
    getSelect(container, '[name="matchMode"]').value = "contains";
    getSelect(container, '[name="category"]').value = "freeform";
    getForm(container).dispatchEvent(new SubmitEvent("submit"));
    await flushAsyncHandlers();

    expect(addRule).toHaveBeenCalledWith({
      pattern: "Fluff",
      action: "warn",
      matchMode: "contains",
      category: "freeform",
      enabled: true,
      source: "manual",
    });
    expect(container.textContent).toContain("Fluff");
    expect(getContentGrid(container).className).not.toContain("has-editor");
  });

  it("edits an existing rule from the form", async () => {
    const container = document.createElement("div");
    const updatedRule = createRule({ id: "rule-1", pattern: "Slow Burn Updated" });
    const updateRule = vi.fn(async () => updatedRule);

    await renderOptionsApp(container, createDeps({ updateRule }));
    getButton(container, '[data-rule-action="edit"][data-rule-id="rule-1"]').click();
    getInput(container, '[name="pattern"]').value = "Slow Burn Updated";
    getForm(container).dispatchEvent(new SubmitEvent("submit"));
    await flushAsyncHandlers();

    expect(updateRule).toHaveBeenCalledWith("rule-1", {
      pattern: "Slow Burn Updated",
      action: "highlight",
      matchMode: "exact",
      category: "freeform",
      enabled: true,
    });
    expect(container.textContent).toContain("Slow Burn Updated");
    expect(getContentGrid(container).className).not.toContain("has-editor");
  });

  it("deletes a rule after confirmation", async () => {
    const container = document.createElement("div");
    const deleteRule = vi.fn(async () => undefined);

    await renderOptionsApp(container, createDeps({ deleteRule, confirmDelete: vi.fn(() => true) }));
    getButton(container, '[data-rule-action="delete"][data-rule-id="rule-1"]').click();
    await flushAsyncHandlers();

    expect(deleteRule).toHaveBeenCalledWith("rule-1");
    expect(container.textContent).not.toContain("Slow Burn");
  });

  it("does not delete a rule when confirmation is cancelled", async () => {
    const container = document.createElement("div");
    const deleteRule = vi.fn(async () => undefined);

    await renderOptionsApp(container, createDeps({ deleteRule, confirmDelete: vi.fn(() => false) }));
    getButton(container, '[data-rule-action="delete"][data-rule-id="rule-1"]').click();
    await flushAsyncHandlers();

    expect(deleteRule).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Slow Burn");
  });

  it("toggles a rule enabled state", async () => {
    const container = document.createElement("div");
    const toggleRule = vi.fn(async () => createRule({ id: "rule-1", enabled: false }));

    await renderOptionsApp(container, createDeps({ toggleRule }));
    getInput(container, '[data-rule-action="toggle"][data-rule-id="rule-1"]').dispatchEvent(
      new Event("change")
    );
    await flushAsyncHandlers();

    expect(toggleRule).toHaveBeenCalledWith("rule-1");
    expect(container.querySelector('[data-rule-row][data-rule-id="rule-1"]')?.className).toContain(
      "is-disabled"
    );
  });

  it("shows an error when a storage operation fails", async () => {
    const container = document.createElement("div");
    const alertError = vi.fn();

    await renderOptionsApp(
      container,
      createDeps({
        toggleRule: vi.fn(async () => {
          throw new Error("Storage failed");
        }),
        alertError,
      })
    );
    getInput(container, '[data-rule-action="toggle"][data-rule-id="rule-1"]').dispatchEvent(
      new Event("change")
    );
    await flushAsyncHandlers();

    expect(alertError).toHaveBeenCalledWith("Storage failed");
  });
});

function createDeps(overrides: Partial<OptionsAppDeps> = {}): OptionsAppDeps {
  return {
    listRules: vi.fn(async () => [
      createRule({ id: "rule-1", pattern: "Slow Burn", action: "highlight" }),
      createRule({ id: "rule-2", pattern: "Angst", action: "warn", enabled: false }),
    ]),
    addRule: vi.fn(async (input) => createRule({ id: "rule-created", ...input })),
    updateRule: vi.fn(async (id, patch) => createRule({ id, ...patch })),
    deleteRule: vi.fn(async () => undefined),
    toggleRule: vi.fn(async (id) => createRule({ id, enabled: false })),
    getSettings: vi.fn(async () => DEFAULT_SETTINGS),
    saveSettings: vi.fn(async (patch) => ({ ...DEFAULT_SETTINGS, ...patch })),
    confirmDelete: vi.fn(() => true),
    alertError: vi.fn(),
    logError: vi.fn(),
    ...overrides,
  };
}

function createRule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: "rule-1",
    pattern: "Slow Burn",
    action: "highlight",
    matchMode: "exact",
    category: "freeform",
    enabled: true,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function getInput(container: HTMLElement, selector: string): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>(selector);
  if (!input) throw new Error(`Missing input: ${selector}`);
  return input;
}

function getSelect(container: HTMLElement, selector: string): HTMLSelectElement {
  const select = container.querySelector<HTMLSelectElement>(selector);
  if (!select) throw new Error(`Missing select: ${selector}`);
  return select;
}

function getButton(container: HTMLElement, selector: string): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>(selector);
  if (!button) throw new Error(`Missing button: ${selector}`);
  return button;
}

function getForm(container: HTMLElement): HTMLFormElement {
  const form = container.querySelector<HTMLFormElement>("[data-rule-form]");
  if (!form) throw new Error("Missing rule form");
  return form;
}

function getStyleForm(container: HTMLElement): HTMLFormElement {
  const form = container.querySelector<HTMLFormElement>("[data-style-form]");
  if (!form) throw new Error("Missing style form");
  return form;
}

function getStylePreview(container: HTMLElement, action: "highlight" | "warn"): HTMLElement {
  const preview = container.querySelector<HTMLElement>(`[data-style-preview="${action}"]`);
  if (!preview) throw new Error(`Missing style preview: ${action}`);
  return preview;
}

function getEditor(container: HTMLElement): HTMLElement {
  const editor = container.querySelector<HTMLElement>("[data-options-editor]");
  if (!editor) throw new Error("Missing options editor");
  return editor;
}

function getContentGrid(container: HTMLElement): HTMLElement {
  const grid = container.querySelector<HTMLElement>(".options-content-grid");
  if (!grid) throw new Error("Missing options content grid");
  return grid;
}

function getRuleList(container: HTMLElement): HTMLElement {
  const list = container.querySelector<HTMLElement>("[data-options-rule-list]");
  if (!list) throw new Error("Missing options rule list");
  return list;
}

async function flushAsyncHandlers(): Promise<void> {
  for (let i = 0; i < 6; i += 1) {
    await Promise.resolve();
  }
}
