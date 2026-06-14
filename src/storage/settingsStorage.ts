import type { Settings } from "../core/types";
import { DEFAULT_ACTION_STYLES } from "../core/actionStyles";
import { STORAGE_KEY_SETTINGS } from "../shared/constants";
import type { RuntimeMessage } from "../shared/message";

export const DEFAULT_SETTINGS: Settings = {
  extensionEnabled: true,
  hoverButtonEnabled: true,
  showToast: true,
  hideWorkMode: "collapse",
  enableOnWorkDetailPage: true,
  languagePreference: "auto",
  actionStyles: DEFAULT_ACTION_STYLES,
};

interface ChromeLike {
  storage: {
    local: {
      get(key: string | null): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
    };
  };
  runtime?: {
    sendMessage(message: RuntimeMessage): Promise<unknown>;
  };
}

export async function getSettings(): Promise<Settings> {
  try {
    const result = await getChrome().storage.local.get(STORAGE_KEY_SETTINGS);
    const stored = result[STORAGE_KEY_SETTINGS];
    const settings = mergeSettings(stored);

    validateSettingsInput(settings);
    return settings;
  } catch {
    return cloneDefaultSettings();
  }
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  validateSettingsInput(patch);

  const current = await getSettings();
  const updated = mergeSettings({ ...current, ...patch });
  validateSettingsInput(updated);

  await getChrome().storage.local.set({ [STORAGE_KEY_SETTINGS]: updated });
  await notifyUpdate({ type: "SETTINGS_UPDATED" });
  return updated;
}

export async function resetSettings(): Promise<Settings> {
  const defaults = cloneDefaultSettings();
  await getChrome().storage.local.set({ [STORAGE_KEY_SETTINGS]: defaults });
  await notifyUpdate({ type: "SETTINGS_UPDATED" });
  return defaults;
}

export function validateSettingsInput(input: Partial<Settings>): void {
  validateBooleanField(input, "extensionEnabled");
  validateBooleanField(input, "hoverButtonEnabled");
  validateBooleanField(input, "showToast");
  validateBooleanField(input, "enableOnWorkDetailPage");
  validateActionStylesInput(input.actionStyles);

  if (
    input.languagePreference !== undefined &&
    input.languagePreference !== "auto" &&
    input.languagePreference !== "en" &&
    input.languagePreference !== "zh_CN"
  ) {
    throw new Error(`Invalid languagePreference: ${String(input.languagePreference)}`);
  }

  if (
    input.hideWorkMode !== undefined &&
    input.hideWorkMode !== "collapse" &&
    input.hideWorkMode !== "hide"
  ) {
    throw new Error(`Invalid hideWorkMode: ${String(input.hideWorkMode)}`);
  }
}

function mergeSettings(input: unknown): Settings {
  const stored = isObjectRecord(input) ? input : {};
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    actionStyles: mergeActionStyles(stored.actionStyles),
  };
}

function mergeActionStyles(input: unknown): Settings["actionStyles"] {
  const stored = isObjectRecord(input) ? input : {};
  return {
    highlight: {
      ...DEFAULT_ACTION_STYLES.highlight,
      ...(isObjectRecord(stored.highlight) ? stored.highlight : {}),
    },
    warn: {
      ...DEFAULT_ACTION_STYLES.warn,
      ...(isObjectRecord(stored.warn) ? stored.warn : {}),
    },
  };
}

function cloneDefaultSettings(): Settings {
  return mergeSettings(DEFAULT_SETTINGS);
}

function validateActionStylesInput(input: unknown): void {
  if (input === undefined) return;
  if (!isObjectRecord(input)) {
    throw new Error("Invalid actionStyles: expected object");
  }

  validateActionStyleInput(input.highlight, "highlight");
  validateActionStyleInput(input.warn, "warn");
}

function validateActionStyleInput(input: unknown, action: "highlight" | "warn"): void {
  if (input === undefined) return;
  if (!isObjectRecord(input)) {
    throw new Error(`Invalid actionStyles.${action}: expected object`);
  }

  validateOptionalString(input.label, `actionStyles.${action}.label`);
  validateOptionalHexColor(input.backgroundColor, `actionStyles.${action}.backgroundColor`);
  validateOptionalHexColor(input.textColor, `actionStyles.${action}.textColor`);
}

function validateOptionalString(value: unknown, key: string): void {
  if (value === undefined) return;
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Invalid ${key}: expected non-empty string`);
  }
}

function validateOptionalHexColor(value: unknown, key: string): void {
  if (value === undefined) return;
  if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value)) {
    throw new Error(`Invalid ${key}: expected #RRGGBB color`);
  }
}

function validateBooleanField(input: Partial<Settings>, key: keyof Settings): void {
  if (input[key] !== undefined && typeof input[key] !== "boolean") {
    throw new Error(`Invalid ${key}: expected boolean`);
  }
}

async function notifyUpdate(message: RuntimeMessage): Promise<void> {
  try {
    await getChrome().runtime?.sendMessage(message);
  } catch {
    // Options/popup can run without a listener during early implementation.
  }
}

function getChrome(): ChromeLike {
  const chromeApi = (globalThis as typeof globalThis & { chrome?: ChromeLike }).chrome;
  if (!chromeApi) {
    throw new Error("Chrome extension API is unavailable");
  }
  return chromeApi;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
