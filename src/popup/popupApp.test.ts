import type { HitStats } from "../shared/message";
import type { Settings } from "../core/types";
import { DEFAULT_ACTION_STYLES } from "../core/actionStyles";
import { renderPopupApp, type PopupAppDeps } from "./popupApp";

const getGlobalToggle = (container: HTMLElement) => container.querySelector<HTMLInputElement>("[data-popup-toggle]")!;
const getHoverToggle = (container: HTMLElement) => container.querySelector<HTMLInputElement>("[data-popup-hover-toggle]")!;
const getNotice = (container: HTMLElement) => container.querySelector<HTMLElement>("[data-popup-notice]")!;

async function changeToggle(toggle: HTMLInputElement, checked: boolean): Promise<void> {
  toggle.checked = checked;
  toggle.dispatchEvent(new Event("change"));
  await flushAsyncHandlers();
}

describe("renderPopupApp", () => {
  it("labels the header toggle as global and removes the redundant paused notice", async () => {
    const container = document.createElement("div");
    await renderPopupApp(container, createDeps({ getSettings: vi.fn(async () => createSettings({ extensionEnabled: false })) }));

    expect(getGlobalToggle(container).checked).toBe(false);
    expect(getGlobalToggle(container).getAttribute("aria-label")).toBe("Enable extension on all sites");
    expect(container.querySelector("[data-popup-global-status]")?.textContent).toBe("Global · Paused");
    expect(getNotice(container).hidden).toBe(true);
    expect(container.querySelector("[data-popup-hover-status]")?.textContent).toBe("Paused globally");
    expect(getHoverToggle(container).disabled).toBe(true);
    expect(getHoverToggle(container).checked).toBe(false);
    expect(container.querySelector("[data-popup-options]")?.classList.contains("popup-button-primary")).toBe(true);
  });

  it("pauses and resumes without overwriting the quick-add preference or adding a notice", async () => {
    const container = document.createElement("div");
    const deps = createDeps();
    await renderPopupApp(container, deps);
    const toggle = getGlobalToggle(container);

    toggle.checked = false;
    toggle.dispatchEvent(new Event("change"));
    expect(container.querySelector("[data-popup-global-save-status]")?.textContent).toBe("");
    expect(getHoverToggle(container).disabled).toBe(true);
    await flushAsyncHandlers();

    expect(deps.saveSettings).toHaveBeenCalledWith({ extensionEnabled: false });
    expect(container.querySelector("[data-popup-global-status]")?.textContent).toBe("Global · Paused");
    expect(getNotice(container).hidden).toBe(true);
    expect(container.querySelector(".popup-stats")?.getAttribute("data-state")).toBe("paused");
    expect(getHoverToggle(container).checked).toBe(false);
    expect(container.querySelector("[data-popup-hover-status]")?.textContent).toBe("Paused globally");
    expect(toggle.disabled).toBe(false);

    await changeToggle(toggle, true);
    expect(deps.saveSettings).toHaveBeenLastCalledWith({ extensionEnabled: true });
    expect(container.querySelector(".popup-stats")?.getAttribute("data-state")).toBe("active");
    expect(getHoverToggle(container).checked).toBe(true);
    expect(getHoverToggle(container).disabled).toBe(false);
    expect(container.querySelector("[data-popup-hover-status]")?.textContent).toBe("On");
    expect(getNotice(container).hidden).toBe(true);
    expect(deps.saveSettings).toHaveBeenCalledTimes(2);
  });

  it("refreshes the stats on resume instead of reusing the initial snapshot", async () => {
    const container = document.createElement("div");
    const sendMessageToTab = vi.fn()
      .mockResolvedValueOnce(createHitStats({ highlight: 0 }))
      .mockResolvedValueOnce(createHitStats({ highlight: 5 }));
    await renderPopupApp(container, createDeps({
      getSettings: vi.fn(async () => createSettings({ extensionEnabled: false })), sendMessageToTab,
    }));
    await changeToggle(getGlobalToggle(container), true);
    expect(sendMessageToTab).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-stat="highlight"] strong')?.textContent).toBe("5");
  });

  it("reverts the global toggle and dependent controls after a save failure", async () => {
    const container = document.createElement("div");
    const deps = createDeps({ saveSettings: vi.fn(async () => { throw new Error("storage failed"); }) });
    await renderPopupApp(container, deps);
    await changeToggle(getGlobalToggle(container), false);

    expect(getGlobalToggle(container).checked).toBe(true);
    expect(container.querySelector("[data-popup-global-status]")?.textContent).toBe("Global · On");
    expect(container.querySelector("[data-popup-global-save-status]")?.textContent).toBe("Could not save. Try again.");
    expect(getHoverToggle(container).checked).toBe(true);
    expect(getHoverToggle(container).disabled).toBe(false);
    expect(deps.logError).toHaveBeenCalledTimes(1);
  });

  it("renders the three stats without a redundant active notice", async () => {
    const container = document.createElement("div");
    await renderPopupApp(container, createDeps({
      sendMessageToTab: vi.fn(async () => createHitStats({ highlight: 2, warn: 1, hideWork: 1, totalRules: 7 })),
    }));
    expect(getNotice(container).hidden).toBe(true);
    expect(getNotice(container).textContent).toBe("");
    expect(container.textContent).toContain("AO3 work page");
    expect(container.textContent).toContain("Highlight tags2");
    expect(container.textContent).toContain("Warning1");
    expect(container.textContent).toContain("Collapse work1");
    expect(container.textContent).not.toContain("Local only");
    expect(container.textContent).not.toContain("MVP");
  });

  it("uses custom action labels in stats", async () => {
    const container = document.createElement("div");
    await renderPopupApp(container, createDeps({
      getSettings: vi.fn(async () => createSettings({ actionStyles: {
        highlight: { label: "Like", backgroundColor: "#fff4d8", textColor: "#5f3b00" },
        warn: { label: "Avoid", backgroundColor: "#f4e6e3", textColor: "#990000" },
      } })),
      sendMessageToTab: vi.fn(async () => createHitStats({ highlight: 2, warn: 1 })),
    }));
    expect(container.textContent).toContain("Like tags2");
    expect(container.textContent).toContain("Avoid1");
  });

  it("shows zeros in stats without adding a separate empty notice", async () => {
    const container = document.createElement("div");
    await renderPopupApp(container, createDeps({ sendMessageToTab: vi.fn(async () => createHitStats({ highlight: 0 })) }));
    expect(getNotice(container).hidden).toBe(true);
    expect(container.querySelectorAll(".popup-stat-value")).toHaveLength(3);
    expect([...container.querySelectorAll(".popup-stat-value")].map((value) => value.textContent)).toEqual(["0", "0", "0"]);
    expect(getHoverToggle(container).disabled).toBe(false);
  });

  it("distinguishes an unadded website without offering quick authorization", async () => {
    const container = document.createElement("div");
    const deps = createNoAccessDeps({ getCurrentTab: vi.fn(async () => ({ id: 12, url: "https://example.com/story" })) });
    await renderPopupApp(container, deps);
    expect(container.querySelector(".popup-page-label")?.textContent).toBe("example.com");
    expect(getNotice(container).dataset.notice).toBe("unadded");
    expect(getNotice(container).textContent).toContain("example.com has not been added.");
    expect(getNotice(container).textContent).toContain("Run on sites");
    expect(container.querySelector("[data-popup-grant-access]")).toBeNull();
    expect(deps.requestAo3Access).not.toHaveBeenCalled();
    expect(getHoverToggle(container).disabled).toBe(true);
    expect(container.querySelector("[data-popup-hover-status]")?.textContent).toBe("Not running on this site");
    expect(container.querySelector<HTMLElement>(".popup-stats")?.hidden).toBe(true);
  });

  it.each(["https://archiveofourown.org/works/123", "https://mirror.example/works/123"])(
    "shows reload rather than missing access for an authorized page with no response: %s", async (url) => {
      const container = document.createElement("div");
      const deps = createDeps({
        getCurrentTab: vi.fn(async () => ({ id: 12, url })),
        sendMessageToTab: vi.fn(async () => { throw new Error("No receiver"); }),
      });
      await renderPopupApp(container, deps);
      expect(deps.hasSiteAccess).toHaveBeenCalledWith(url);
      expect(getNotice(container).dataset.notice).toBe("refresh");
      expect(container.querySelector("[data-popup-grant-access]")).toBeNull();
      expect(container.querySelector("[data-popup-reload]")?.textContent).toBe("Reload page");
      expect(container.querySelector("[data-popup-options]")?.classList.contains("popup-button-primary")).toBe(false);
      expect(getHoverToggle(container).disabled).toBe(true);
    }
  );

  it.each(["access", "unadded", "refresh"])("restores the underlying %s state after global pause", async (state) => {
    const container = document.createElement("div");
    const deps = createNoAccessDeps({
      getCurrentTab: vi.fn(async () => ({ id: 12, url: state === "unadded" ? "https://example.com" : "https://archiveofourown.org" })),
      hasSiteAccess: vi.fn(async () => state === "refresh"),
    });
    await renderPopupApp(container, deps);
    expect(getNotice(container).dataset.notice).toBe(state);
    await changeToggle(getGlobalToggle(container), false);
    expect(getNotice(container).hidden).toBe(true);
    expect(container.querySelector("[data-popup-hover-status]")?.textContent).toBe("Paused globally");
    await changeToggle(getGlobalToggle(container), true);
    expect(getNotice(container).hidden).toBe(false);
    expect(getNotice(container).dataset.notice).toBe(state);
    expect(getHoverToggle(container).disabled).toBe(true);
  });

  it.each([null, { id: 12, url: "about:addons" }, { id: 12, url: "chrome://extensions/" }, { id: 12, url: "invalid" }])(
    "shows a single unavailable notice for an unsupported tab: %j", async (tab) => {
      const container = document.createElement("div");
      const deps = createNoAccessDeps({ getCurrentTab: vi.fn(async () => tab) });
      await renderPopupApp(container, deps);
      expect(getNotice(container).dataset.notice).toBe("unavailable");
      expect(container.querySelectorAll(".popup-notice")).toHaveLength(1);
      expect(container.querySelector("[data-popup-grant-access]")).toBeNull();
      expect(deps.hasSiteAccess).not.toHaveBeenCalled();
      expect(getHoverToggle(container).disabled).toBe(true);
    }
  );

  it("keeps settings-load errors visible and disables toggles rather than saving fallback values", async () => {
    const container = document.createElement("div");
    const deps = createDeps({ getSettings: vi.fn(async () => { throw new Error("storage failed"); }) });
    await renderPopupApp(container, deps);
    expect(getNotice(container).hidden).toBe(false);
    expect(getNotice(container).textContent).toContain("Settings could not load.");
    expect(getGlobalToggle(container).disabled).toBe(true);
    expect(getHoverToggle(container).disabled).toBe(true);
    expect(container.textContent).toContain("Manage rules");
    expect(deps.logError).toHaveBeenCalledTimes(1);
  });

  it("opens options and then closes the popup", async () => {
    const container = document.createElement("div");
    const calls: string[] = [];
    await renderPopupApp(container, createDeps({
      openOptionsPage: vi.fn(() => calls.push("options")), closePopup: vi.fn(() => calls.push("close")),
    }));
    container.querySelector<HTMLButtonElement>("[data-popup-options]")?.click();
    expect(calls).toEqual(["options", "close"]);
  });

  it("renders only one notice for missing official AO3 access", async () => {
    const container = document.createElement("div");
    await renderPopupApp(container, createNoAccessDeps());
    expect(container.querySelectorAll(".popup-notice")).toHaveLength(1);
    expect(getNotice(container).dataset.notice).toBe("access");
    expect(getNotice(container).textContent).toContain("AO3 access is off.");
    expect(container.querySelector("[data-popup-grant-access]")?.textContent).toBe("Allow access");
    expect(container.querySelector("[data-popup-options]")?.classList.contains("popup-button-primary")).toBe(false);
  });

  it("requests access synchronously and moves focus to reload when granted", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const deps = createNoAccessDeps();
    await renderPopupApp(container, deps);
    const button = container.querySelector<HTMLButtonElement>("[data-popup-grant-access]")!;
    button.focus();
    button.click();
    expect(deps.requestAo3Access).toHaveBeenCalledTimes(1);
    await flushAsyncHandlers();
    expect(getNotice(container).dataset.notice).toBe("refresh");
    expect(container.querySelector("[data-popup-grant-access]")).toBeNull();
    expect(document.activeElement).toBe(container.querySelector("[data-popup-reload]"));
    expect(container.querySelectorAll(".popup-notice")).toHaveLength(1);
    container.remove();
  });

  it.each([
    ["denied", vi.fn(async () => false)],
    ["rejected", vi.fn(async () => { throw new Error("request failed"); })],
    ["synchronous error", vi.fn((): Promise<boolean> => { throw new Error("request failed"); })],
  ])("keeps authorization retry available after %s", async (_label, requestAo3Access) => {
    const container = document.createElement("div");
    await renderPopupApp(container, createNoAccessDeps({ requestAo3Access }));
    container.querySelector<HTMLButtonElement>("[data-popup-grant-access]")?.click();
    await flushAsyncHandlers();
    expect(container.querySelector<HTMLButtonElement>("[data-popup-grant-access]")?.disabled).toBe(false);
    expect(getNotice(container).dataset.notice).toBe("access");
    expect(container.querySelector("[role=alert]")?.textContent).toContain("Access was not granted.");
    expect(getGlobalToggle(container).checked).toBe(true);
  });

  it("keeps official access recovery available when an ungranted tab URL is hidden", async () => {
    const container = document.createElement("div");
    let allowed = false;
    const deps = createNoAccessDeps({
      getCurrentTab: vi.fn(async () => ({ id: 12 })),
      hasSiteAccess: vi.fn(async () => allowed),
      requestAo3Access: vi.fn(async () => { allowed = true; return true; }),
    });
    await renderPopupApp(container, deps);
    expect(deps.hasSiteAccess).toHaveBeenCalledWith("https://archiveofourown.org/");
    expect(getNotice(container).dataset.notice).toBe("access");
    container.querySelector<HTMLButtonElement>("[data-popup-grant-access]")?.click();
    await flushAsyncHandlers();
    expect(getNotice(container).dataset.notice).toBe("refresh");
    await changeToggle(getGlobalToggle(container), false);
    expect(getNotice(container).hidden).toBe(true);
    await changeToggle(getGlobalToggle(container), true);
    expect(getNotice(container).hidden).toBe(false);
    expect(getNotice(container).dataset.notice).toBe("refresh");
  });

  it("uses a generic inactive-page hint for a hidden URL when official access is enabled", async () => {
    const container = document.createElement("div");
    await renderPopupApp(container, createDeps({
      getCurrentTab: vi.fn(async () => ({ id: 12 })), sendMessageToTab: vi.fn(async () => null),
    }));
    expect(getNotice(container).dataset.notice).toBe("unavailable");
    expect(getNotice(container).textContent).toContain("Not running on this page");
    expect(container.querySelector("[data-popup-grant-access]")).toBeNull();
    expect(container.querySelector(".popup-page-label")).toBeNull();
    expect(container.textContent).not.toContain("Current tab");
  });

  it("reloads the original tab and closes the popup only after reload succeeds", async () => {
    const container = document.createElement("div");
    const calls: string[] = [];
    const reloadTab = vi.fn(async (id: number) => { calls.push(`reload ${id}`); });
    await renderPopupApp(container, createDeps({
      sendMessageToTab: vi.fn(async () => null), reloadTab, closePopup: () => calls.push("close"),
    }));
    container.querySelector<HTMLButtonElement>("[data-popup-reload]")?.click();
    await flushAsyncHandlers();
    expect(calls).toEqual(["reload 12", "close"]);
  });

  it("keeps reload available and reports reload failure", async () => {
    const container = document.createElement("div");
    const deps = createDeps({
      sendMessageToTab: vi.fn(async () => null),
      reloadTab: vi.fn(async () => { throw new Error("tab gone"); }),
    });
    await renderPopupApp(container, deps);
    container.querySelector<HTMLButtonElement>("[data-popup-reload]")?.click();
    await flushAsyncHandlers();
    expect(container.querySelector<HTMLButtonElement>("[data-popup-reload]")?.disabled).toBe(false);
    expect(container.querySelector("[role=alert]")?.textContent).toContain("Could not reload.");
    expect(deps.closePopup).not.toHaveBeenCalled();
  });

  it("trusts a responding content script even if permission queries would say no", async () => {
    const container = document.createElement("div");
    const deps = createDeps({ hasSiteAccess: vi.fn(async () => false) });
    await renderPopupApp(container, deps);
    expect(deps.hasSiteAccess).not.toHaveBeenCalled();
    expect(container.querySelector("[data-popup-access-notice]")).toBeNull();
    expect(getNotice(container).hidden).toBe(true);
  });

  it("logs a failed permission query without claiming access is granted or missing", async () => {
    const container = document.createElement("div");
    const deps = createDeps({
      sendMessageToTab: vi.fn(async () => null),
      hasSiteAccess: vi.fn(async () => { throw new Error("permissions failed"); }),
    });
    await renderPopupApp(container, deps);
    expect(getNotice(container).dataset.notice).toBe("unavailable");
    expect(container.querySelector("[data-popup-grant-access]")).toBeNull();
    expect(container.querySelector("[data-popup-reload]")).toBeNull();
    expect(deps.logError).toHaveBeenCalledTimes(1);
  });

  it("saves quick-add preferences without transient success feedback", async () => {
    const container = document.createElement("div");
    const deps = createDeps();
    await renderPopupApp(container, deps);
    expect(container.textContent).toContain("Tag hover quick-add");
    expect(container.textContent).toContain("Show the + button next to AO3 tags.");
    await changeToggle(getHoverToggle(container), false);
    expect(deps.saveSettings).toHaveBeenCalledWith({ hoverButtonEnabled: false });
    expect(getHoverToggle(container).checked).toBe(false);
    expect(container.querySelector("[data-popup-hover-status]")?.textContent).toBe("Off");
    expect(container.querySelector("[data-popup-hover-save-status]")?.textContent).toBe("");
  });

  it("preserves the saved off preference across global pause and resume", async () => {
    const container = document.createElement("div");
    await renderPopupApp(container, createDeps());
    await changeToggle(getHoverToggle(container), false);
    await changeToggle(getGlobalToggle(container), false);
    expect(getHoverToggle(container).disabled).toBe(true);
    await changeToggle(getGlobalToggle(container), true);
    expect(getHoverToggle(container).checked).toBe(false);
    expect(getHoverToggle(container).disabled).toBe(false);
    expect(container.querySelector("[data-popup-hover-status]")?.textContent).toBe("Off");
  });

  it("prevents overlapping global and quick-add saves and restores controls after failure", async () => {
    const container = document.createElement("div");
    let rejectSave!: (error: Error) => void;
    const deps = createDeps({ saveSettings: vi.fn(() => new Promise<Settings>((_resolve, reject) => { rejectSave = reject; })) });
    await renderPopupApp(container, deps);
    const toggle = getHoverToggle(container);
    toggle.checked = false;
    toggle.dispatchEvent(new Event("change"));
    expect(toggle.disabled).toBe(true);
    expect(getGlobalToggle(container).disabled).toBe(true);
    rejectSave(new Error("write failed"));
    await flushAsyncHandlers();
    expect(toggle.disabled).toBe(false);
    expect(toggle.checked).toBe(true);
    expect(getGlobalToggle(container).disabled).toBe(false);
    expect(container.querySelector("[data-popup-hover-save-status]")?.textContent).toBe("Could not save. Try again.");
  });

  it("uses the compact options-style switch controls", async () => {
    const container = document.createElement("div");
    await renderPopupApp(container, createDeps());
    expect(getHoverToggle(container).getAttribute("aria-label")).toBe("Tag hover quick-add enabled");
    expect(container.querySelectorAll(".popup-switch-track")).toHaveLength(2);
  });

  it("uses touch quick-add copy without hover or an extra empty notice", async () => {
    const container = document.createElement("div");
    await renderPopupApp(container, createDeps({
      detectInputMode: vi.fn(() => "touch" as const),
      sendMessageToTab: vi.fn(async () => createHitStats({ highlight: 0 })),
    }));
    expect(container.querySelector(".popup-setting-title")?.textContent).toBe("Tag quick-add");
    expect(container.querySelector(".popup-setting-description")?.textContent).toBe("Show the + button at the bottom of AO3 pages.");
    expect(getHoverToggle(container).getAttribute("aria-label")).toBe("Tag quick-add enabled");
    expect(getNotice(container).hidden).toBe(true);
    expect(container.textContent).not.toContain("hover");
  });

  it("renders Chinese global and inactive-site state labels", async () => {
    const container = document.createElement("div");
    await renderPopupApp(container, createNoAccessDeps({
      getSettings: vi.fn(async () => createSettings({ languagePreference: "zh_CN" })),
    }));
    expect(container.querySelector("[data-popup-global-status]")?.textContent).toBe("全局 · 开启");
    expect(container.querySelector("[data-popup-hover-status]")?.textContent).toBe("此网站未运行");
    expect(getNotice(container).textContent).toContain("未授权访问 AO3");
  });
});

function createDeps(overrides: Partial<PopupAppDeps> = {}): PopupAppDeps {
  return {
    getSettings: vi.fn(async () => createSettings()),
    saveSettings: vi.fn(async (patch) => createSettings(patch)),
    getCurrentTab: vi.fn(async () => ({ id: 12, url: "https://archiveofourown.org/works/123" })),
    sendMessageToTab: vi.fn(async () => createHitStats()),
    openOptionsPage: vi.fn(),
    closePopup: vi.fn(),
    hasSiteAccess: vi.fn(async () => true),
    requestAo3Access: vi.fn(async () => true),
    reloadTab: vi.fn(async () => {}),
    detectInputMode: vi.fn(() => "pointer" as const),
    logError: vi.fn(),
    ...overrides,
  };
}

function createNoAccessDeps(overrides: Partial<PopupAppDeps> = {}): PopupAppDeps {
  return createDeps({ hasSiteAccess: vi.fn(async () => false), sendMessageToTab: vi.fn(async () => null), ...overrides });
}

function createSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    extensionEnabled: true, hoverButtonEnabled: true, showToast: true, hideWorkMode: "collapse",
    enableOnWorkDetailPage: true, languagePreference: "en", actionStyles: DEFAULT_ACTION_STYLES, ...overrides,
  };
}

function createHitStats(overrides: Partial<HitStats> = {}): HitStats {
  return { highlight: 1, warn: 0, hideWork: 0, totalRules: 1, ...overrides };
}

async function flushAsyncHandlers(): Promise<void> {
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
}
