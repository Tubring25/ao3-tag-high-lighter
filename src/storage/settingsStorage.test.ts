import {
  DEFAULT_SETTINGS,
  getSettings,
  resetSettings,
  saveSettings,
  validateSettingsInput,
} from "./settingsStorage";
import { STORAGE_KEY_SETTINGS } from "../shared/constants";
import type { Settings } from "../core/types";

const store: Record<string, unknown> = {};
const sendMessage = vi.fn();

describe("settingsStorage", () => {
  beforeEach(() => {
    for (const key of Object.keys(store)) {
      delete store[key];
    }

    sendMessage.mockReset();
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn(async (key: string | null) => {
            if (key === null) return { ...store };
            return { [key]: store[key] };
          }),
          set: vi.fn(async (items: Record<string, unknown>) => {
            Object.assign(store, items);
          }),
          remove: vi.fn(async (key: string) => {
            delete store[key];
          }),
        },
      },
      runtime: {
        sendMessage,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns default settings when no settings are stored", async () => {
    await expect(getSettings()).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it("returns default settings when storage read fails", async () => {
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn(async () => {
            throw new Error("storage unavailable");
          }),
          set: vi.fn(),
          remove: vi.fn(),
        },
      },
      runtime: {
        sendMessage,
      },
    });

    await expect(getSettings()).resolves.toEqual(DEFAULT_SETTINGS);
  });

  it("merges stored partial settings with defaults", async () => {
    store[STORAGE_KEY_SETTINGS] = {
      extensionEnabled: false,
      hideWorkMode: "hide",
    };

    await expect(getSettings()).resolves.toEqual({
      ...DEFAULT_SETTINGS,
      extensionEnabled: false,
      hideWorkMode: "hide",
    });
  });

  it("merges stored partial action styles with defaults", async () => {
    store[STORAGE_KEY_SETTINGS] = {
      actionStyles: {
        highlight: {
          label: "Like",
          backgroundColor: "#fff4d8",
        },
      },
    };

    await expect(getSettings()).resolves.toEqual({
      ...DEFAULT_SETTINGS,
      actionStyles: {
        highlight: {
          ...DEFAULT_SETTINGS.actionStyles.highlight,
          label: "Like",
          backgroundColor: "#fff4d8",
        },
        warn: DEFAULT_SETTINGS.actionStyles.warn,
      },
    });
  });

  it("saves partial settings patches and returns complete settings", async () => {
    const updated = await saveSettings({ extensionEnabled: false });

    expect(updated).toEqual({ ...DEFAULT_SETTINGS, extensionEnabled: false });
    expect(store[STORAGE_KEY_SETTINGS]).toEqual(updated);
    expect(sendMessage).toHaveBeenCalledWith({ type: "SETTINGS_UPDATED" });
  });

  it("resets settings to defaults", async () => {
    store[STORAGE_KEY_SETTINGS] = {
      ...DEFAULT_SETTINGS,
      extensionEnabled: false,
      hideWorkMode: "hide",
    };

    const reset = await resetSettings();

    expect(reset).toEqual(DEFAULT_SETTINGS);
    expect(store[STORAGE_KEY_SETTINGS]).toEqual(DEFAULT_SETTINGS);
  });

  it("validates settings inputs", () => {
    expect(() =>
      validateSettingsInput({ hideWorkMode: "bad" as Settings["hideWorkMode"] })
    ).toThrow("Invalid hideWorkMode: bad");
    expect(() =>
      validateSettingsInput({ extensionEnabled: "yes" as unknown as boolean })
    ).toThrow("Invalid extensionEnabled: expected boolean");
    expect(() =>
      validateSettingsInput({ hoverButtonEnabled: "yes" as unknown as boolean })
    ).toThrow("Invalid hoverButtonEnabled: expected boolean");
    expect(() =>
      validateSettingsInput({ showToast: "yes" as unknown as boolean })
    ).toThrow("Invalid showToast: expected boolean");
    expect(() =>
      validateSettingsInput({ enableOnWorkDetailPage: "yes" as unknown as boolean })
    ).toThrow("Invalid enableOnWorkDetailPage: expected boolean");
    expect(() =>
      validateSettingsInput({ languagePreference: "fr" as Settings["languagePreference"] })
    ).toThrow("Invalid languagePreference: fr");
    expect(() =>
      validateSettingsInput({
        actionStyles: {
          ...DEFAULT_SETTINGS.actionStyles,
          warn: {
            ...DEFAULT_SETTINGS.actionStyles.warn,
            backgroundColor: "red",
          },
        },
      })
    ).toThrow("Invalid actionStyles.warn.backgroundColor: expected #RRGGBB color");
  });

  it("keeps writes successful when update notification has no listener", async () => {
    sendMessage.mockRejectedValueOnce(new Error("No listener"));

    const updated = await saveSettings({ showToast: false });

    expect(store[STORAGE_KEY_SETTINGS]).toEqual(updated);
  });
});
