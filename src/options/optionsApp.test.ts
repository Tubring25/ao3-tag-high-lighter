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
    expect(container.querySelector("h1")?.textContent).toBe("规则");
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

  it("deletes selected rules in bulk after confirmation", async () => {
    const container = document.createElement("div");
    const deleteRules = vi.fn(async () => undefined);

    await renderOptionsApp(
      container,
      createDeps({ deleteRules, confirmBulkDelete: vi.fn(() => true) })
    );
    checkInput(container, '[data-rule-select][data-rule-id="rule-1"]');
    checkInput(container, '[data-rule-select][data-rule-id="rule-2"]');

    expect(container.textContent).toContain("2 selected");
    getButton(container, "[data-options-bulk-delete]").click();
    await flushAsyncHandlers();

    expect(deleteRules).toHaveBeenCalledWith(["rule-1", "rule-2"]);
    expect(container.textContent).not.toContain("Slow Burn");
    expect(container.textContent).not.toContain("Angst");
  });

  it("selects all visible rules from the table header", async () => {
    const container = document.createElement("div");

    await renderOptionsApp(container, createDeps());
    checkInput(container, "[data-options-select-all]");

    expect(container.textContent).toContain("2 selected");
    expect(getInput(container, '[data-rule-select][data-rule-id="rule-1"]').checked).toBe(true);
    expect(getInput(container, '[data-rule-select][data-rule-id="rule-2"]').checked).toBe(true);
  });

  it("does not bulk delete selected rules when confirmation is cancelled", async () => {
    const container = document.createElement("div");
    const deleteRules = vi.fn(async () => undefined);

    await renderOptionsApp(
      container,
      createDeps({ deleteRules, confirmBulkDelete: vi.fn(() => false) })
    );
    checkInput(container, '[data-rule-select][data-rule-id="rule-1"]');
    getButton(container, "[data-options-bulk-delete]").click();
    await flushAsyncHandlers();

    expect(deleteRules).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Slow Burn");
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
    deleteRules: vi.fn(async () => undefined),
    toggleRule: vi.fn(async (id) => createRule({ id, enabled: false })),
    getSettings: vi.fn(async () => DEFAULT_SETTINGS),
    saveSettings: vi.fn(async (patch) => ({ ...DEFAULT_SETTINGS, ...patch })),
    confirmDelete: vi.fn(() => true),
    confirmBulkDelete: vi.fn(() => true),
    confirmRemoveSites: vi.fn(() => true),
    alertError: vi.fn(),
    listCustomHosts: vi.fn(async () => []),
    requestCustomHost: vi.fn(async () => true),
    removeCustomHosts: vi.fn(async () => true),
    addCustomHostsListener: vi.fn(),
    logError: vi.fn(),
    ...overrides,
  };
}

describe("options custom sites", () => {
  it("lists official AO3 as locked and custom sites in the rules-style table", async () => {
    const container = document.createElement("div");

    await renderOptionsApp(
      container,
      createDeps({ listCustomHosts: vi.fn(async () => ["alpha.example", "mirror.example"]) })
    );
    const sitesButton = getButton(container, "[data-options-sites]");
    expect(sitesButton.parentElement?.className).toBe("options-nav");
    expect(sitesButton.previousElementSibling?.getAttribute("data-sidebar-status-filter")).toBe("disabled");
    expect(sitesButton.getAttribute("aria-current")).toBeNull();
    sitesButton.click();
    expect(getButton(container, "[data-options-sites]").getAttribute("aria-current")).toBe("page");

    const rows = [...container.querySelectorAll<HTMLElement>("[data-site-host]")];
    expect(rows.map((row) => row.dataset.siteHost)).toEqual(["archiveofourown.org", "alpha.example", "mirror.example"]);
    expect(rows[0].querySelector("button, input")).toBeNull();
    expect(rows[0].textContent).toContain("Default");
    expect(rows[1].querySelector('[data-site-select="alpha.example"]')).not.toBeNull();
    expect(getButton(container, '[data-site-remove="mirror.example"]').textContent).toBe("Remove");
    expect(container.querySelector("[data-options-site-search]")).not.toBeNull();
    expect(container.querySelector("[data-options-rule-list]")).toBeNull();
    expect(getContentGrid(container).className).not.toContain("has-editor");
    expect(container.querySelectorAll(".options-nav-item.is-active")).toHaveLength(1);
  });

  it("returns to the original rule filter after visiting the independent sites page", async () => {
    const container = document.createElement("div");
    await renderOptionsApp(container, createDeps());
    getButton(container, '[data-sidebar-status-filter="disabled"]').click();
    getButton(container, "[data-options-sites]").click();
    expect(container.querySelector("[data-options-rule-list]")).toBeNull();
    getButton(container, '[data-sidebar-status-filter="disabled"]').click();
    expect(container.querySelector("[data-options-sites-page]")).toBeNull();
    expect(container.querySelectorAll("[data-rule-row]")).toHaveLength(1);
    expect(container.querySelector("[data-rule-row]")?.textContent).toContain("Angst");
    expect(container.querySelectorAll(".options-nav-item.is-active")).toHaveLength(1);
  });

  it("opens an empty add-site editor without an example address", async () => {
    const container = document.createElement("div");
    await renderOptionsApp(container, createDeps());
    getButton(container, "[data-options-sites]").click();
    getButton(container, "[data-options-site-add]").click();

    expect(getContentGrid(container).className).toContain("has-editor");
    expect(container.querySelector("[data-options-site-editor] h2")?.textContent).toBe("New site");
    const input = getInput(getSiteForm(container), "[name=host]");
    expect(input.value).toBe("");
    expect(input.placeholder).toBe("");
    expect(container.textContent).not.toMatch(/archiveofourown\.(?!org)/);
  });

  it("requests access synchronously for a normalized host and shows the reload hint", async () => {
    const container = document.createElement("div");
    const hosts: string[] = [];
    const requestCustomHost = vi.fn(async (host: string) => {
      hosts.push(host);
      return true;
    });

    await renderOptionsApp(
      container,
      createDeps({ requestCustomHost, listCustomHosts: vi.fn(async () => [...hosts]) })
    );
    getButton(container, "[data-options-sites]").click();
    getButton(container, "[data-options-site-add]").click();
    const form = getSiteForm(container);
    getInput(form, "[name=host]").value = " https://Mirror.Example/works/1 ";
    form.dispatchEvent(new Event("submit", { cancelable: true }));

    expect(requestCustomHost).toHaveBeenCalledWith("mirror.example");
    expect(getButton(form, "[type=submit]").disabled).toBe(true);
    await flushAsyncHandlers();

    expect(getSiteMessage(container)).toBe("mirror.example is on. Reload pages already open on it.");
    expect(container.querySelector('[data-site-host="mirror.example"]')).not.toBeNull();
    expect(getContentGrid(container).className).not.toContain("has-editor");
    expect(getInput(getSiteForm(container), "[name=host]").value).toBe("");
  });

  it.each([
    ["", "Enter a site address."],
    ["not a host", "Enter a valid site address."],
    ["www.archiveofourown.org", "Official AO3 is always on."],
    ["mirror.example", "mirror.example is already on."],
  ])("rejects %j without requesting access", async (value, message) => {
    const container = document.createElement("div");
    const requestCustomHost = vi.fn(async () => true);

    await renderOptionsApp(
      container,
      createDeps({ requestCustomHost, listCustomHosts: vi.fn(async () => ["mirror.example"]) })
    );
    getButton(container, "[data-options-sites]").click();
    getButton(container, "[data-options-site-add]").click();
    const form = getSiteForm(container);
    getInput(form, "[name=host]").value = value;
    form.dispatchEvent(new Event("submit", { cancelable: true }));

    expect(requestCustomHost).not.toHaveBeenCalled();
    expect(getSiteMessage(container)).toBe(message);
  });

  it.each([
    ["denied", vi.fn(async () => false), "Access wasn't granted, so the site wasn't added."],
    ["rejected", vi.fn(async () => { throw new Error("request failed"); }), "Couldn't change site access. Try again."],
  ])("keeps the editor and typed host when the request is %s", async (_label, requestCustomHost, message) => {
    const container = document.createElement("div");

    await renderOptionsApp(container, createDeps({ requestCustomHost }));
    getButton(container, "[data-options-sites]").click();
    getButton(container, "[data-options-site-add]").click();
    const form = getSiteForm(container);
    getInput(form, "[name=host]").value = "mirror.example";
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await flushAsyncHandlers();

    expect(getSiteMessage(container)).toBe(message);
    expect(getContentGrid(container).className).toContain("has-editor");
    expect(getInput(getSiteForm(container), "[name=host]").value).toBe("mirror.example");
    expect(getButton(getSiteForm(container), "[type=submit]").disabled).toBe(false);
    expect(container.querySelector('[data-site-host="mirror.example"]')).toBeNull();
  });

  it("opens the edit panel from a row and closes it on an outside click without permission changes", async () => {
    const container = document.createElement("div");
    const deps = createDeps({ listCustomHosts: vi.fn(async () => ["old.example"]) });
    await renderOptionsApp(container, deps);
    getButton(container, "[data-options-sites]").click();
    (container.querySelector('[data-site-host="old.example"] .sites-host') as HTMLElement).click();

    expect(getContentGrid(container).className).toContain("has-editor");
    expect(container.querySelector('[data-site-host="old.example"]')?.className).toContain("is-selected");
    expect(container.querySelector("[data-options-site-editor] h2")?.textContent).toBe("Editing “old.example”");
    expect(getInput(getSiteForm(container), "[name=host]").value).toBe("old.example");

    (container.querySelector("[data-options-sites-page] h1") as HTMLElement).click();
    expect(getContentGrid(container).className).not.toContain("has-editor");
    expect(getInput(getSiteForm(container), "[name=host]").value).toBe("");
    expect(deps.requestCustomHost).not.toHaveBeenCalled();
    expect(deps.removeCustomHosts).not.toHaveBeenCalled();
  });

  it("approves the replacement address before removing the original site", async () => {
    const container = document.createElement("div");
    let hosts = ["old.example"];
    let grant: (value: boolean) => void = () => undefined;
    const requestCustomHost = vi.fn(() => new Promise<boolean>((resolve) => { grant = resolve; }));
    const removeCustomHosts = vi.fn(async (removed: readonly string[]) => {
      hosts = hosts.filter((value) => !removed.includes(value));
      return true;
    });
    await renderOptionsApp(container, createDeps({ listCustomHosts: vi.fn(async () => [...hosts]), requestCustomHost, removeCustomHosts }));
    getButton(container, "[data-options-sites]").click();
    getButton(container, '[data-site-edit="old.example"]').click();
    const form = getSiteForm(container);
    getInput(form, "[name=host]").value = "https://New.example/works/1";
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    expect(requestCustomHost).toHaveBeenCalledWith("new.example");
    expect(removeCustomHosts).not.toHaveBeenCalled();
    hosts.push("new.example");
    grant(true);
    await flushAsyncHandlers();
    expect(removeCustomHosts).toHaveBeenCalledWith(["old.example"]);
    expect(container.querySelector('[data-site-host="new.example"]')).not.toBeNull();
    expect(container.querySelector('[data-site-host="old.example"]')).toBeNull();
    expect(getContentGrid(container).className).not.toContain("has-editor");
    expect(getButton(getSiteForm(container), "[type=submit]").textContent).toBe("Enable");
  });

  it("keeps the original address and edit draft when replacement permission is denied", async () => {
    const container = document.createElement("div");
    const removeCustomHosts = vi.fn(async () => true);
    await renderOptionsApp(container, createDeps({
      listCustomHosts: vi.fn(async () => ["old.example"]),
      requestCustomHost: vi.fn(async () => false), removeCustomHosts,
    }));
    getButton(container, "[data-options-sites]").click();
    getButton(container, '[data-site-edit="old.example"]').click();
    const form = getSiteForm(container);
    getInput(form, "[name=host]").value = "new.example";
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await flushAsyncHandlers();
    expect(removeCustomHosts).not.toHaveBeenCalled();
    expect(container.querySelector('[data-site-host="old.example"]')).not.toBeNull();
    expect(getInput(getSiteForm(container), "[name=host]").value).toBe("new.example");
    expect(getButton(getSiteForm(container), "[type=submit]").textContent).toBe("Save");
  });

  it.each([false, new Error("remove failed")])("explains both retained addresses if removing the original fails: %s", async (result) => {
    const container = document.createElement("div");
    const hosts = ["old.example"];
    await renderOptionsApp(container, createDeps({
      listCustomHosts: vi.fn(async () => [...hosts]),
      requestCustomHost: vi.fn(async (host) => { hosts.push(host); return true; }),
      removeCustomHosts: vi.fn(async () => { if (result instanceof Error) throw result; return result; }),
    }));
    getButton(container, "[data-options-sites]").click();
    getButton(container, '[data-site-edit="old.example"]').click();
    const form = getSiteForm(container);
    getInput(form, "[name=host]").value = "new.example";
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    await flushAsyncHandlers();
    expect(getSiteMessage(container)).toContain("Both sites remain enabled");
    expect(container.querySelectorAll("[data-site-host]")).toHaveLength(3);
  });

  it("removes a custom site after confirmation", async () => {
    const container = document.createElement("div");
    let hosts = ["mirror.example"];
    const confirmRemoveSites = vi.fn(() => true);
    const removeCustomHosts = vi.fn(async (removed: readonly string[]) => {
      hosts = hosts.filter((candidate) => !removed.includes(candidate));
      return true;
    });

    await renderOptionsApp(
      container,
      createDeps({ confirmRemoveSites, removeCustomHosts, listCustomHosts: vi.fn(async () => hosts) })
    );
    getButton(container, "[data-options-sites]").click();
    getButton(container, '[data-site-remove="mirror.example"]').click();

    expect(confirmRemoveSites).toHaveBeenCalledWith(["mirror.example"]);
    expect(removeCustomHosts).toHaveBeenCalledWith(["mirror.example"]);
    await flushAsyncHandlers();

    expect(container.querySelector('[data-site-host="mirror.example"]')).toBeNull();
    expect(getSiteMessage(container)).toBe("mirror.example removed. Reload pages already open on it.");
  });

  it("does not remove a site when confirmation is cancelled", async () => {
    const container = document.createElement("div");
    const removeCustomHosts = vi.fn(async () => true);
    await renderOptionsApp(container, createDeps({
      listCustomHosts: vi.fn(async () => ["mirror.example"]),
      confirmRemoveSites: vi.fn(() => false),
      removeCustomHosts,
    }));
    getButton(container, "[data-options-sites]").click();
    getButton(container, '[data-site-remove="mirror.example"]').click();
    await flushAsyncHandlers();

    expect(removeCustomHosts).not.toHaveBeenCalled();
    expect(container.querySelector('[data-site-host="mirror.example"]')).not.toBeNull();
  });

  it("clears the edit panel when the site being edited is removed", async () => {
    const container = document.createElement("div");
    let hosts = ["old.example", "other.example"];
    await renderOptionsApp(container, createDeps({
      listCustomHosts: vi.fn(async () => [...hosts]),
      removeCustomHosts: vi.fn(async (removed: readonly string[]) => {
        hosts = hosts.filter((host) => !removed.includes(host));
        return true;
      }),
    }));
    getButton(container, "[data-options-sites]").click();
    getButton(container, '[data-site-edit="old.example"]').click();
    getInput(getSiteForm(container), "[name=host]").value = "typed.example";
    getInput(getSiteForm(container), "[name=host]").dispatchEvent(new Event("input"));
    getButton(container, '[data-site-remove="old.example"]').click();
    await flushAsyncHandlers();

    expect(getContentGrid(container).className).not.toContain("has-editor");
    expect(container.querySelector("[data-options-site-editor] h2")?.textContent).toBe("New site");
    expect(getInput(getSiteForm(container), "[name=host]").value).toBe("");
    getButton(container, "[data-options-site-add]").click();
    expect(getInput(getSiteForm(container), "[name=host]").value).toBe("");
  });

  it("searches sites and bulk removes the selected visible custom sites", async () => {
    const container = document.createElement("div");
    let hosts = ["alpha.example", "beta.example", "mirror.test"];
    const confirmRemoveSites = vi.fn(() => true);
    const removeCustomHosts = vi.fn(async (removed: readonly string[]) => {
      hosts = hosts.filter((host) => !removed.includes(host));
      return true;
    });
    await renderOptionsApp(
      container,
      createDeps({ listCustomHosts: vi.fn(async () => [...hosts]), confirmRemoveSites, removeCustomHosts })
    );
    getButton(container, "[data-options-sites]").click();

    const search = getInput(container, "[data-options-site-search]");
    search.value = " EXAMPLE ";
    search.dispatchEvent(new Event("input"));
    expect([...container.querySelectorAll<HTMLElement>("[data-site-host]")].map((row) => row.dataset.siteHost))
      .toEqual(["alpha.example", "beta.example"]);
    expect(container.querySelector("[data-options-site-search]")).toBe(search);

    checkInput(container, "[data-options-site-select-all]");
    expect(container.textContent).toContain("2 selected");
    getButton(container, "[data-options-site-bulk-remove]").click();

    expect(confirmRemoveSites).toHaveBeenCalledWith(["alpha.example", "beta.example"]);
    expect(removeCustomHosts).toHaveBeenCalledWith(["alpha.example", "beta.example"]);
    await flushAsyncHandlers();

    expect(getSiteMessage(container)).toBe("2 sites removed. Reload pages already open on them.");
    expect(container.querySelector("[data-options-site-bulk-bar]")?.className).not.toContain("is-active");
    expect(container.querySelector("[data-options-site-list] .options-empty")).not.toBeNull();
    getButton(container, "[data-options-site-list] .options-empty-action").click();
    expect([...container.querySelectorAll<HTMLElement>("[data-site-host]")].map((row) => row.dataset.siteHost))
      .toEqual(["archiveofourown.org", "mirror.test"]);
  });

  it("closes the edit panel when search hides the edited site", async () => {
    const container = document.createElement("div");
    await renderOptionsApp(container, createDeps({ listCustomHosts: vi.fn(async () => ["old.example"]) }));
    getButton(container, "[data-options-sites]").click();
    getButton(container, '[data-site-edit="old.example"]').click();
    const search = getInput(container, "[data-options-site-search]");
    search.value = "nothing";
    search.dispatchEvent(new Event("input"));

    expect(getContentGrid(container).className).not.toContain("has-editor");
    expect(getInput(getSiteForm(container), "[name=host]").value).toBe("");
  });

  it("refreshes the open site list when browser permissions change elsewhere", async () => {
    const container = document.createElement("div");
    let hosts: string[] = ["old.example"];
    let permissionsChanged: () => void = () => undefined;

    await renderOptionsApp(
      container,
      createDeps({
        listCustomHosts: vi.fn(async () => hosts),
        addCustomHostsListener: vi.fn((callback: () => void) => {
          permissionsChanged = callback;
        }),
      })
    );
    getButton(container, "[data-options-sites]").click();
    getButton(container, '[data-site-edit="old.example"]').click();
    hosts = ["mirror.example"];
    permissionsChanged();
    await flushAsyncHandlers();

    expect(container.querySelector('[data-site-host="mirror.example"]')).not.toBeNull();
    expect(getContentGrid(container).className).not.toContain("has-editor");
  });

  it("still renders when the site list cannot be read", async () => {
    const container = document.createElement("div");
    const logError = vi.fn();

    await renderOptionsApp(
      container,
      createDeps({ logError, listCustomHosts: vi.fn(async () => { throw new Error("permissions failed"); }) })
    );
    getButton(container, "[data-options-sites]").click();

    expect(container.querySelectorAll("[data-site-host]")).toHaveLength(1);
    expect(getInput(container, "[data-options-site-select-all]").disabled).toBe(true);
    expect(logError).toHaveBeenCalledTimes(1);
  });
});

function getSiteForm(container: HTMLElement): HTMLFormElement {
  const form = container.querySelector<HTMLFormElement>("[data-site-form]");
  if (!form) throw new Error("Missing site form");
  return form;
}

function getSiteMessage(container: HTMLElement): string {
  return [...container.querySelectorAll<HTMLElement>("[data-sites-message], [data-site-form-message]")]
    .filter((message) => !message.hidden)
    .map((message) => message.textContent ?? "")
    .join(" ");
}

describe("options rule save recovery", () => {
  it.each(["create", "edit"])("keeps every %s draft field on failure and retry", async (mode) => {
    const container = document.createElement("div");
    const save = vi.fn().mockRejectedValueOnce(new Error("Disk unavailable")).mockResolvedValue(createRule({ pattern: "Draft" }));
    const deps = createDeps(mode === "create" ? { addRule: save } : { updateRule: save });
    await renderOptionsApp(container, deps);
    getButton(container, mode === "create" ? "[data-options-add]" : "[data-rule-action=edit]").click();
    const form = getForm(container);
    getInput(form, "[name=pattern]").value = "Draft";
    getSelect(form, "[name=action]").value = "hideWork";
    getSelect(form, "[name=matchMode]").value = "wildcard";
    getSelect(form, "[name=category]").value = "character";
    getInput(form, "[name=enabled]").checked = false;
    form.dispatchEvent(new Event("input", { bubbles: true }));
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    expect(getButton(form, "[type=submit]").disabled).toBe(true);
    form.dispatchEvent(new Event("submit", { cancelable: true }));
    expect(save).toHaveBeenCalledTimes(1);
    await flushAsyncHandlers();
    expect(getForm(container)).toBe(form);
    expect(container.querySelector("[role=alert]")?.textContent).toContain("try saving again");
    expect(getButton(form, "[type=submit]").disabled).toBe(false);
    getButton(container, "[data-sidebar-status-filter=all]").click();
    if (mode === "edit") getButton(container, "[data-rule-action=edit]").click();
    else getButton(container, "[data-options-add]").click();
    const restored = getForm(container);
    expect(getInput(restored, "[name=pattern]").value).toBe("Draft");
    expect(getSelect(restored, "[name=action]").value).toBe("hideWork");
    expect(getSelect(restored, "[name=matchMode]").value).toBe("wildcard");
    expect(getSelect(restored, "[name=category]").value).toBe("character");
    expect(getInput(restored, "[name=enabled]").checked).toBe(false);
    restored.dispatchEvent(new Event("submit", { cancelable: true }));
    await flushAsyncHandlers();
    expect(save).toHaveBeenCalledTimes(2);
    expect(container.querySelector("[role=alert]")?.textContent).toBe("");
    expect(getEditor(container).ariaHidden).toBe("true");
  });

  it("keeps create and per-rule edit drafts independent across switches", async () => {
    const container = document.createElement("div");
    await renderOptionsApp(container, createDeps());
    getButton(container, "[data-options-add]").click();
    getInput(container, "[name=pattern]").value = "New draft";
    getForm(container).dispatchEvent(new Event("input"));
    getButton(container, "[data-rule-action=edit][data-rule-id=rule-1]").click();
    expect(getInput(container, "[name=pattern]").value).toBe("Slow Burn");
    getInput(container, "[name=pattern]").value = "Edit draft";
    getForm(container).dispatchEvent(new Event("input"));
    getButton(container, "[data-options-add]").click();
    expect(getInput(container, "[name=pattern]").value).toBe("New draft");
    getButton(container, "[data-rule-action=edit][data-rule-id=rule-1]").click();
    expect(getInput(container, "[name=pattern]").value).toBe("Edit draft");
  });

  it("explains duplicate rules without clearing the form", async () => {
    const container = document.createElement("div");
    await renderOptionsApp(container, createDeps({ addRule: vi.fn().mockRejectedValue(new Error("Duplicate rule: Slow Burn")) }));
    getButton(container, "[data-options-add]").click();
    getInput(container, "[name=pattern]").value = "Slow Burn";
    getForm(container).dispatchEvent(new Event("submit", { cancelable: true }));
    await flushAsyncHandlers();
    expect(container.querySelector("[role=alert]")?.textContent).toContain("already exists");
    expect(getInput(container, "[name=pattern]").value).toBe("Slow Burn");
  });
});

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

function checkInput(container: HTMLElement, selector: string): void {
  const input = getInput(container, selector);
  input.checked = true;
  input.dispatchEvent(new Event("change"));
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
