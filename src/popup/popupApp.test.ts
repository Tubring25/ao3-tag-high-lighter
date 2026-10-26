import type { HitStats } from "../shared/message";
import type { Settings } from "../core/types";
import { DEFAULT_ACTION_STYLES } from "../core/actionStyles";
import { renderPopupApp, type PopupAppDeps } from "./popupApp";

describe("renderPopupApp", () => {
  it("renders the global toggle from settings", async () => {
    const container = document.createElement("div");

    await renderPopupApp(container, createDeps({ getSettings: vi.fn(async () => createSettings({ extensionEnabled: false })) }));

    expect(container.querySelector<HTMLInputElement>("[data-popup-toggle]")?.checked).toBe(false);
    expect(container.querySelector("[data-popup-global-status]")?.textContent).toBe("Paused");
  });

  it("saves settings without showing transient saving feedback when the global toggle changes", async () => {
    const container = document.createElement("div");
    const saveSettings = vi.fn(async (patch: Partial<Settings>) => createSettings(patch));

    await renderPopupApp(container, createDeps({ saveSettings }));
    const toggle = container.querySelector<HTMLInputElement>("[data-popup-toggle]");
    if (!toggle) throw new Error("Toggle was not rendered");

    toggle.checked = false;
    toggle.dispatchEvent(new Event("change"));
    expect(container.querySelector("[data-popup-global-save-status]")?.textContent).toBe("");
    await flushAsyncHandlers();

    expect(saveSettings).toHaveBeenCalledWith({ extensionEnabled: false });
    expect(container.querySelector("[data-popup-global-status]")?.textContent).toBe("Paused");
    expect(container.querySelector("[data-popup-global-save-status]")?.textContent).toBe("");
    expect(container.textContent).toContain("Extension paused");
    expect(container.textContent).toContain("Matches found. Turn on the extension to apply styles.");
    expect(container.querySelector("[data-popup-notice]")?.getAttribute("data-notice")).toBe("paused");
    expect(container.querySelector(".popup-stats")?.getAttribute("data-state")).toBe("paused");
    expect(container.querySelector("[data-popup-options]")?.getAttribute("data-state")).toBe("paused");
    expect(container.querySelector<HTMLInputElement>("[data-popup-hover-toggle]")?.checked).toBe(false);
    expect(container.querySelector<HTMLInputElement>("[data-popup-hover-toggle]")?.disabled).toBe(true);
    expect(container.querySelector("[data-popup-hover-status]")?.textContent).toBe("Off");
    expect(toggle.disabled).toBe(false);

    toggle.checked = true;
    toggle.dispatchEvent(new Event("change"));
    await flushAsyncHandlers();

    expect(saveSettings).toHaveBeenLastCalledWith({ extensionEnabled: true });
    expect(container.querySelector(".popup-stats")?.getAttribute("data-state")).toBeNull();
    expect(container.querySelector("[data-popup-options]")?.getAttribute("data-state")).toBeNull();
    expect(container.querySelector<HTMLInputElement>("[data-popup-hover-toggle]")?.checked).toBe(true);
    expect(container.querySelector<HTMLInputElement>("[data-popup-hover-toggle]")?.disabled).toBe(false);
    expect(container.querySelector("[data-popup-hover-status]")?.textContent).toBe("On");
  });

  it("reverts the global toggle and reports save failure", async () => {
    const container = document.createElement("div");
    const logError = vi.fn();
    const saveSettings = vi.fn(async () => {
      throw new Error("storage failed");
    });

    await renderPopupApp(container, createDeps({ logError, saveSettings }));
    const toggle = container.querySelector<HTMLInputElement>("[data-popup-toggle]");
    if (!toggle) throw new Error("Toggle was not rendered");

    toggle.checked = false;
    toggle.dispatchEvent(new Event("change"));
    await flushAsyncHandlers();

    expect(toggle.checked).toBe(true);
    expect(container.querySelector("[data-popup-global-status]")?.textContent).toBe("On");
    expect(container.querySelector("[data-popup-global-save-status]")?.textContent).toBe("Could not save. Try again.");
    expect(logError).toHaveBeenCalledTimes(1);
  });

  it("renders stats returned from the active tab", async () => {
    const container = document.createElement("div");

    await renderPopupApp(
      container,
      createDeps({
        sendMessageToTab: vi.fn(async () => createHitStats({ highlight: 2, warn: 1, hideWork: 1, totalRules: 7 })),
      })
    );

    expect(container.textContent).toContain("4 matches on this page");
    expect(container.textContent).toContain("AO3 work page");
    expect(container.textContent).toContain("Highlight tags2");
    expect(container.textContent).toContain("Warning1");
    expect(container.textContent).toContain("Collapse work1");
    expect(container.textContent).not.toContain("Caution");
    expect(container.textContent).not.toContain("Local only");
    expect(container.textContent).not.toContain("MVP");
  });

  it("uses custom action labels in stats", async () => {
    const container = document.createElement("div");

    await renderPopupApp(
      container,
      createDeps({
        getSettings: vi.fn(async () =>
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
          })
        ),
        sendMessageToTab: vi.fn(async () => createHitStats({ highlight: 2, warn: 1 })),
      })
    );

    expect(container.textContent).toContain("Like tags2");
    expect(container.textContent).toContain("Avoid1");
  });

  it("uses the active tab host as the popup page label", async () => {
    const container = document.createElement("div");

    await renderPopupApp(
      container,
      createDeps({
        getCurrentTab: vi.fn(async () => ({ id: 12, url: "https://example.com/story" })),
        sendMessageToTab: vi.fn(async () => null),
      })
    );

    expect(container.textContent).toContain("example.com");
  });

  it("renders a distinct zero-match state", async () => {
    const container = document.createElement("div");

    await renderPopupApp(
      container,
      createDeps({
        sendMessageToTab: vi.fn(async () => createHitStats({ highlight: 0, warn: 0, hideWork: 0, totalRules: 7 })),
      })
    );

    expect(container.textContent).toContain("No rule matches on this page yet");
    expect(container.querySelector(".popup-notice")?.getAttribute("data-notice")).toBe("empty");
  });

  it("shows a fallback when there is no active tab", async () => {
    const container = document.createElement("div");

    await renderPopupApp(container, createDeps({ getCurrentTab: vi.fn(async () => null) }));

    expect(container.textContent).toContain("Open an AO3 page.");
  });

  it("shows a fallback when content script stats are unavailable", async () => {
    const container = document.createElement("div");

    await renderPopupApp(
      container,
      createDeps({
        sendMessageToTab: vi.fn(async () => {
          throw new Error("No receiving end");
        }),
      })
    );

    expect(container.textContent).toContain("Open an AO3 page.");
  });

  it("renders an explicit error state when settings fail to load", async () => {
    const container = document.createElement("div");
    const logError = vi.fn();

    await renderPopupApp(
      container,
      createDeps({
        getSettings: vi.fn(async () => {
          throw new Error("storage failed");
        }),
        logError,
      })
    );

    expect(container.textContent).toContain("Settings could not load.");
    expect(container.textContent).toContain("Manage rules");
    expect(logError).toHaveBeenCalledTimes(1);
  });

  it("opens the options page from the manage button, then closes the popup", async () => {
    const container = document.createElement("div");
    const calls: string[] = [];
    const openOptionsPage = vi.fn(() => calls.push("openOptionsPage"));
    const closePopup = vi.fn(() => calls.push("closePopup"));

    await renderPopupApp(container, createDeps({ openOptionsPage, closePopup }));
    container.querySelector<HTMLButtonElement>("[data-popup-options]")?.click();

    expect(openOptionsPage).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(["openOptionsPage", "closePopup"]);
  });

  it("does not render the access notice when AO3 access is granted", async () => {
    const container = document.createElement("div");

    await renderPopupApp(container, createDeps());

    expect(container.querySelector("[data-popup-access-notice]")).toBeNull();
    expect(container.querySelector("[data-popup-grant-access]")).toBeNull();
  });

  it("renders the access notice before page status when AO3 access is missing", async () => {
    const container = document.createElement("div");

    await renderPopupApp(container, createDeps({ hasAo3Access: vi.fn(async () => false) }));

    const notice = container.querySelector("[data-popup-access-notice]");
    expect(notice?.textContent).toContain("AO3 access is off.");
    expect(notice?.textContent).toContain("Allow access to archiveofourown.org so tags can be marked.");
    expect(notice?.querySelector("[data-popup-grant-access]")?.textContent).toBe("Allow access");
    expect(notice?.nextElementSibling?.hasAttribute("data-popup-notice")).toBe(true);
  });

  it("requests AO3 access synchronously and shows a reload hint when granted", async () => {
    const container = document.createElement("div");
    const requestAo3Access = vi.fn(async () => true);

    await renderPopupApp(container, createDeps({ hasAo3Access: vi.fn(async () => false), requestAo3Access }));
    container.querySelector<HTMLButtonElement>("[data-popup-grant-access]")?.click();

    expect(requestAo3Access).toHaveBeenCalledTimes(1);
    await flushAsyncHandlers();

    const notice = container.querySelector("[data-popup-access-notice]");
    expect(notice?.textContent).toBe("Access granted. Reload the AO3 page.");
    expect(container.querySelector("[data-popup-grant-access]")).toBeNull();
  });

  it.each([
    ["denied", vi.fn(async () => false)],
    ["rejected", vi.fn(async () => { throw new Error("request failed"); })],
  ])("keeps the grant button when the access request is %s", async (_label, requestAo3Access) => {
    const container = document.createElement("div");

    await renderPopupApp(container, createDeps({ hasAo3Access: vi.fn(async () => false), requestAo3Access }));
    container.querySelector<HTMLButtonElement>("[data-popup-grant-access]")?.click();
    await flushAsyncHandlers();

    const button = container.querySelector<HTMLButtonElement>("[data-popup-grant-access]");
    expect(button).not.toBeNull();
    expect(button?.disabled).toBe(false);
    expect(container.textContent).not.toContain("Access granted.");
  });

  it("treats a failed access check as granted", async () => {
    const container = document.createElement("div");
    const logError = vi.fn();

    await renderPopupApp(
      container,
      createDeps({ logError, hasAo3Access: vi.fn(async () => { throw new Error("permissions failed"); }) })
    );

    expect(container.querySelector("[data-popup-access-notice]")).toBeNull();
    expect(logError).toHaveBeenCalledTimes(1);
  });

  it("toggles the hover button setting from a labeled switch", async () => {
    const container = document.createElement("div");
    const saveSettings = vi.fn(async (patch: Partial<Settings>) => createSettings(patch));

    await renderPopupApp(container, createDeps({ saveSettings }));
    const toggle = container.querySelector<HTMLInputElement>("[data-popup-hover-toggle]");
    if (!toggle) throw new Error("Hover button toggle was not rendered");

    expect(container.textContent).toContain("Tag hover quick-add");
    expect(container.textContent).toContain("Show the + button next to AO3 tags.");
    expect(container.querySelector("[data-popup-hover-status]")?.textContent).toBe("On");
    expect(toggle.checked).toBe(true);

    toggle.checked = false;
    toggle.dispatchEvent(new Event("change"));
    await flushAsyncHandlers();

    expect(saveSettings).toHaveBeenCalledWith({ hoverButtonEnabled: false });
    expect(container.querySelector("[data-popup-hover-status]")?.textContent).toBe("Off");
    expect(container.querySelector("[data-popup-hover-save-status]")?.textContent).toBe("");
  });

  it("restores the saved hover switch preference when the extension is turned back on", async () => {
    const container = document.createElement("div");
    const saveSettings = vi.fn(async (patch: Partial<Settings>) => createSettings(patch));

    await renderPopupApp(container, createDeps({ saveSettings }));
    const globalToggle = container.querySelector<HTMLInputElement>("[data-popup-toggle]");
    const hoverToggle = container.querySelector<HTMLInputElement>("[data-popup-hover-toggle]");
    if (!globalToggle || !hoverToggle) throw new Error("Toggles were not rendered");

    hoverToggle.checked = false;
    hoverToggle.dispatchEvent(new Event("change"));
    await flushAsyncHandlers();

    globalToggle.checked = false;
    globalToggle.dispatchEvent(new Event("change"));
    await flushAsyncHandlers();

    expect(hoverToggle.checked).toBe(false);
    expect(hoverToggle.disabled).toBe(true);

    globalToggle.checked = true;
    globalToggle.dispatchEvent(new Event("change"));
    await flushAsyncHandlers();

    expect(hoverToggle.checked).toBe(false);
    expect(hoverToggle.disabled).toBe(false);
    expect(container.querySelector("[data-popup-hover-status]")?.textContent).toBe("Off");
  });

  it("uses the compact options-style switch controls", async () => {
    const container = document.createElement("div");

    await renderPopupApp(container, createDeps());

    expect(container.querySelector("[data-popup-toggle]")?.getAttribute("aria-label")).toBe(
      "Extension enabled"
    );
    expect(container.querySelector("[data-popup-hover-toggle]")?.getAttribute("aria-label")).toBe(
      "Tag hover quick-add enabled"
    );
    expect(container.querySelectorAll(".popup-switch-track")).toHaveLength(2);
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
    hasAo3Access: vi.fn(async () => true),
    requestAo3Access: vi.fn(async () => true),
    logError: vi.fn(),
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

function createHitStats(overrides: Partial<HitStats> = {}): HitStats {
  return {
    highlight: 1,
    warn: 0,
    hideWork: 0,
    totalRules: 1,
    ...overrides,
  };
}

async function flushAsyncHandlers(): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    await Promise.resolve();
  }
}
