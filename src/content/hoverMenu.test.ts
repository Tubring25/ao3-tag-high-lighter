import type { ParsedTag, ParsedWork, Rule, Settings } from "../core/types";
import { DEFAULT_ACTION_STYLES } from "../core/actionStyles";
import { mountHoverMenu, unmountHoverMenu, type HoverMenuOptions } from "./hoverMenu";

describe("hoverMenu", () => {
  afterEach(() => {
    unmountHoverMenu();
    document.body.innerHTML = "";
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("supports focus, nearby Tab entry, navigation and Escape without intercepting links", () => {
    vi.useFakeTimers();
    const work = createWork();
    const tag = work.tags[0].element;
    tag.setAttribute("href", "/tags/Slow%20Burn");
    mountHoverMenu([work], createSettings(), createOptions());
    tag.focus();
    expect(getShadowButton()?.hidden).toBe(false);
    expect(tag.getAttribute("aria-description")).toContain("Alt + Arrow Down");
    const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    tag.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(false);
    const click = new Event("click", { bubbles: true, cancelable: true });
    tag.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(false);
    tag.dispatchEvent(new FocusEvent("focus"));
    tag.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
    expect(getShadowRoot()?.activeElement).toBe(getShadowButton());
    getShadowButton()!.click();
    const items = getMenuOptions();
    expect(getShadowRoot()?.activeElement).toBe(items[0]);
    for (const [key, index] of [["ArrowUp", 2], ["ArrowDown", 0], ["End", 2], ["Home", 0]] as const) {
      getShadowRoot()!.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, composed: true, cancelable: true }));
      expect(getShadowRoot()?.activeElement).toBe(items[index]);
    }
    tag.dispatchEvent(new MouseEvent("mouseleave"));
    vi.advanceTimersByTime(300);
    expect(getShadowMenu()?.hidden).toBe(false);
    items[0].dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }));
    expect(getShadowMenu()?.hidden).toBe(true);
    expect(document.activeElement).toBe(tag);
    expect(getShadowButton()?.hidden).toBe(true);
    tag.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", altKey: true, bubbles: true, cancelable: true }));
    expect(getShadowMenu()?.hidden).toBe(false);
    unmountHoverMenu();
    expect(document.activeElement).toBe(tag);
    expect(tag.hasAttribute("aria-keyshortcuts")).toBe(false);
  });

  it.each(["Disk unavailable", "Duplicate rule: Slow Burn"])("shows accessible failure feedback and retries: %s", async (message) => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const work = createWork();
    const tag = work.tags[0].element;
    tag.setAttribute("href", "/tags/Slow%20Burn");
    const addRule = vi.fn().mockRejectedValueOnce(new Error(message)).mockResolvedValueOnce(createRule());
    const options = createOptions({ addRule });
    mountHoverMenu([work], createSettings(), options);
    tag.focus();
    getShadowButton()!.click();
    const option = getMenuOptions()[0];
    option.click();
    option.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    expect(addRule).toHaveBeenCalledTimes(1);
    expect(option.disabled).toBe(true);
    await flushAsyncHandlers();
    expect(getShadowMenu()?.hidden).toBe(false);
    expect(getShadowMenu()?.querySelector("[role=alert]")?.textContent).toContain(message.startsWith("Duplicate") ? "already exists" : "try saving again");
    expect(option.disabled).toBe(false);
    expect(option.textContent).toContain("Try again");
    expect(getShadowRoot()?.activeElement).toBe(option);
    expect(options.onRuleCreated).not.toHaveBeenCalled();
    option.click();
    await flushAsyncHandlers();
    expect(addRule).toHaveBeenCalledTimes(2);
    expect(options.onRuleCreated).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(tag);
    expect(getShadowMenu()?.hidden).toBe(true);
    errorLog.mockRestore();
  });

  it("restores focus when dismissed during save and isolates a remounted menu", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    const work = createWork();
    const tag = work.tags[0].element;
    tag.setAttribute("href", "/tags/example");
    let rejectSave: (error: Error) => void = () => {};
    const addRule = vi.fn(() => new Promise<Rule>((_resolve, reject) => { rejectSave = reject; }));
    mountHoverMenu([work], createSettings(), createOptions({ addRule }));
    tag.focus();
    getShadowButton()!.click();
    getMenuOptions()[0].click();
    expect(getShadowRoot()?.activeElement).toBe(getShadowMenu());
    getShadowMenu()!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, composed: true }));
    expect(document.activeElement).toBe(tag);
    mountHoverMenu([work], createSettings(), createOptions());
    tag.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", altKey: true, bubbles: true }));
    const active = getShadowRoot()?.activeElement;
    rejectSave(new Error("Old save failed"));
    await flushAsyncHandlers();
    expect(getShadowMenu()?.hidden).toBe(false);
    expect(getShadowMenu()?.querySelector("[role=alert]")?.textContent).toBe("");
    expect(getShadowRoot()?.activeElement).toBe(active);
    errorLog.mockRestore();
  });

  it("does not steal outside focus on dismissal", () => {
    const work = createWork();
    work.tags[0].element.setAttribute("href", "/tags/example");
    mountHoverMenu([work], createSettings(), createOptions());
    work.tags[0].element.focus();
    getShadowButton()!.click();
    const outside = document.createElement("button");
    document.body.append(outside);
    outside.focus();
    outside.click();
    expect(getShadowMenu()?.hidden).toBe(true);
    expect(document.activeElement).toBe(outside);
  });

  it("does not mount when hover button is disabled", () => {
    const work = createWork();

    mountHoverMenu([work], createSettings({ hoverButtonEnabled: false }), createOptions());

    expect(document.querySelector("#ao3th-hover-host")).toBeNull();
  });

  it("shows the hover button when a tag is hovered", () => {
    const work = createWork();

    mountHoverMenu([work], createSettings(), createOptions());
    work.tags[0].element.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));

    const button = getShadowButton();
    expect(button).not.toBeNull();
    expect(button?.hidden).toBe(false);
  });

  it("shows the action menu when the hover button is clicked", () => {
    const work = createWork();

    mountHoverMenu([work], createSettings(), createOptions());
    work.tags[0].element.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    getShadowButton()?.click();

    expect(getShadowMenu()?.hidden).toBe(false);
    expect(getShadowButton()?.dataset.ao3thActive).toBe("true");
    expect(getShadowButton()?.getAttribute("aria-expanded")).toBe("true");
    expect(getMenuOptionLabels()).toEqual([
      "Highlight tag",
      "Warn work",
      "Collapse work",
    ]);
  });

  it("uses custom action labels in the quick-add menu", () => {
    const work = createWork();

    mountHoverMenu(
      [work],
      createSettings({
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
      }),
      createOptions()
    );
    work.tags[0].element.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    getShadowButton()?.click();

    expect(getMenuOptionLabels()).toEqual(["Like tag", "Avoid work", "Collapse work"]);
  });

  it("shows the selected tag context in the action menu", () => {
    const work = createWork();

    mountHoverMenu([work], createSettings(), createOptions());
    work.tags[0].element.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    getShadowButton()?.click();

    expect(getShadowRoot()?.querySelector("[data-ao3th-menu-title]")?.textContent).toBe(
      "Add rule for “Slow Burn”"
    );
  });

  it("marks the hovered tag so content CSS can show the inline hover state", () => {
    const work = createWork();

    mountHoverMenu([work], createSettings(), createOptions());
    work.tags[0].element.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));

    expect(work.tags[0].element.dataset.ao3thHovered).toBe("true");
  });

  it("hides the menu when Escape is pressed", () => {
    const work = createWork();

    mountHoverMenu([work], createSettings(), createOptions());
    work.tags[0].element.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    getShadowButton()?.click();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(getShadowButton()?.hidden).toBe(true);
    expect(getShadowButton()?.dataset.ao3thActive).toBe("false");
    expect(getShadowButton()?.getAttribute("aria-expanded")).toBe("false");
    expect(getShadowMenu()?.hidden).toBe(true);
  });

  it("creates a quick-add rule with the selected action", async () => {
    const work = createWork();
    const addRule = vi.fn(async () => createRule());
    const onRuleCreated = vi.fn();

    mountHoverMenu([work], createSettings(), createOptions({ addRule, onRuleCreated }));
    work.tags[0].element.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    getShadowButton()?.click();
    getMenuOptions().find((option) => option.dataset.action === "warn")?.click();
    await flushAsyncHandlers();

    expect(addRule).toHaveBeenCalledWith({
      pattern: "Slow Burn",
      action: "warn",
      matchMode: "exact",
      category: "freeform",
      enabled: true,
      source: "quickAdd",
    });
    expect(onRuleCreated).toHaveBeenCalledTimes(1);
  });

  it("keeps the clicked tag locked while the action menu is open", async () => {
    const work = createWork(["Slow Burn", "Major Character Death"]);
    const addRule = vi.fn(async () => createRule());

    mountHoverMenu([work], createSettings(), createOptions({ addRule }));
    work.tags[0].element.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    getShadowButton()?.click();

    work.tags[1].element.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    getMenuOptions().find((option) => option.dataset.action === "warn")?.click();
    await flushAsyncHandlers();

    expect(addRule).toHaveBeenCalledWith({
      pattern: "Slow Burn",
      action: "warn",
      matchMode: "exact",
      category: "freeform",
      enabled: true,
      source: "quickAdd",
    });
    expect(work.tags[0].element.dataset.ao3thHovered).toBeUndefined();
    expect(work.tags[1].element.dataset.ao3thHovered).toBeUndefined();
  });

  it("shows a toast after quick-add succeeds when enabled", async () => {
    const work = createWork();
    const showToast = vi.fn();

    mountHoverMenu([work], createSettings({ showToast: true }), createOptions({ showToast }));
    work.tags[0].element.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    getShadowButton()?.click();
    getMenuOptions()[0].click();
    await flushAsyncHandlers();

    expect(showToast).toHaveBeenCalledWith("Rule created: Slow Burn");
  });

  it("unmounts the shadow host", () => {
    const work = createWork();

    mountHoverMenu([work], createSettings(), createOptions());
    expect(document.querySelector("#ao3th-hover-host")).not.toBeNull();

    unmountHoverMenu();

    expect(document.querySelector("#ao3th-hover-host")).toBeNull();
  });
});

function createOptions(overrides: Partial<HoverMenuOptions> = {}): HoverMenuOptions {
  return {
    addRule: vi.fn(async () => createRule()),
    onRuleCreated: vi.fn(),
    showToast: vi.fn(),
    ...overrides,
  };
}

function createSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    extensionEnabled: true,
    hoverButtonEnabled: true,
    showToast: true,
    hideWorkMode: "collapse",
    enableOnWorkDetailPage: true,
    languagePreference: "auto",
    actionStyles: DEFAULT_ACTION_STYLES,
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

function createWork(tagTexts: string[] = ["Slow Burn"]): ParsedWork {
  const element = document.createElement("article");
  const tags = tagTexts.map((text, index) => {
    const tagElement = document.createElement("a");
    tagElement.textContent = text;
    document.body.appendChild(tagElement);
    return createTag(tagElement, { id: `tag-${index + 1}`, text, normalizedText: text.toLowerCase() });
  });
  document.body.prepend(element);

  return {
    id: "work-1",
    element,
    tags,
  };
}

function createTag(element: HTMLElement, overrides: Partial<ParsedTag> = {}): ParsedTag {
  return {
    id: "tag-1",
    text: "Slow Burn",
    normalizedText: "slow burn",
    category: "freeform",
    element,
    workId: "work-1",
    ...overrides,
  };
}

function getShadowRoot(): ShadowRoot | null {
  return document.querySelector("#ao3th-hover-host")?.shadowRoot ?? null;
}

function getShadowButton(): HTMLButtonElement | null {
  return getShadowRoot()?.querySelector<HTMLButtonElement>("[data-ao3th-hover-button]") ?? null;
}

function getShadowMenu(): HTMLElement | null {
  return getShadowRoot()?.querySelector<HTMLElement>("[data-ao3th-hover-menu]") ?? null;
}

function getMenuOptions(): HTMLButtonElement[] {
  return Array.from(
    getShadowRoot()?.querySelectorAll<HTMLButtonElement>("[data-ao3th-menu-option]") ?? []
  );
}

function getMenuOptionLabels(): string[] {
  return getMenuOptions().map((option) => option.textContent ?? "");
}

async function flushAsyncHandlers(): Promise<void> {
  for (let i = 0; i < 6; i += 1) {
    await Promise.resolve();
  }
}
