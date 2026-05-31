import type { ParsedTag, ParsedWork, Rule, Settings } from "../core/types";
import { mountHoverMenu, unmountHoverMenu, type HoverMenuOptions } from "./hoverMenu";

describe("hoverMenu", () => {
  afterEach(() => {
    unmountHoverMenu();
    document.body.innerHTML = "";
    vi.clearAllTimers();
    vi.useRealTimers();
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
    expect(getMenuOptions().map((option) => option.textContent)).toEqual([
      "Highlight",
      "Warn",
      "Hide work",
    ]);
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

function createWork(): ParsedWork {
  const element = document.createElement("article");
  const tagElement = document.createElement("a");
  tagElement.textContent = "Slow Burn";
  document.body.append(element, tagElement);

  return {
    id: "work-1",
    element,
    tags: [createTag(tagElement)],
  };
}

function createTag(element: HTMLElement): ParsedTag {
  return {
    id: "tag-1",
    text: "Slow Burn",
    normalizedText: "slow burn",
    category: "freeform",
    element,
    workId: "work-1",
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

async function flushAsyncHandlers(): Promise<void> {
  for (let i = 0; i < 6; i += 1) {
    await Promise.resolve();
  }
}
