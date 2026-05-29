import type { MatchMode, Rule, RuleAction, TagCategory } from "../core/types";
import { renderOptionsApp, type OptionsAppDeps } from "./optionsApp";

describe("renderOptionsApp", () => {
  it("loads and renders existing rules", async () => {
    const container = document.createElement("div");

    await renderOptionsApp(container, createDeps());

    expect(container.textContent).toContain("Slow Burn");
    expect(container.textContent).toContain("highlight");
    expect(container.querySelectorAll("[data-rule-row]")).toHaveLength(2);
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

  it("adds a new rule from the form", async () => {
    const container = document.createElement("div");
    const createdRule = createRule({ id: "rule-3", pattern: "Fluff", action: "mute" });
    const addRule = vi.fn(async () => createdRule);

    await renderOptionsApp(container, createDeps({ addRule }));
    getButton(container, "[data-options-add]").click();
    getInput(container, '[name="pattern"]').value = "Fluff";
    getSelect(container, '[name="action"]').value = "mute";
    getSelect(container, '[name="matchMode"]').value = "contains";
    getSelect(container, '[name="category"]').value = "freeform";
    getForm(container).dispatchEvent(new SubmitEvent("submit"));
    await flushAsyncHandlers();

    expect(addRule).toHaveBeenCalledWith({
      pattern: "Fluff",
      action: "mute",
      matchMode: "contains",
      category: "freeform",
      enabled: true,
      source: "manual",
    });
    expect(container.textContent).toContain("Fluff");
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

async function flushAsyncHandlers(): Promise<void> {
  for (let i = 0; i < 6; i += 1) {
    await Promise.resolve();
  }
}
