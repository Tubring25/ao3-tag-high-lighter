import type { Settings } from "../core/types";
import { STORAGE_KEY_SETTINGS } from "../shared/constants";
import type { RuntimeMessage } from "../shared/message";

export const DEFAULT_SETTINGS: Settings = {
  extensionEnabled: true,
  hoverButtonEnabled: true,
  showToast: true,
  hideWorkMode: "collapse",
  enableOnWorkDetailPage: true,
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
    const settings = {
      ...DEFAULT_SETTINGS,
      ...(isObjectRecord(stored) ? stored : {}),
    };

    validateSettingsInput(settings);
    return settings;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  validateSettingsInput(patch);

  const current = await getSettings();
  const updated: Settings = { ...current, ...patch };
  validateSettingsInput(updated);

  await getChrome().storage.local.set({ [STORAGE_KEY_SETTINGS]: updated });
  await notifyUpdate({ type: "SETTINGS_UPDATED" });
  return updated;
}

export async function resetSettings(): Promise<Settings> {
  const defaults = { ...DEFAULT_SETTINGS };
  await getChrome().storage.local.set({ [STORAGE_KEY_SETTINGS]: defaults });
  await notifyUpdate({ type: "SETTINGS_UPDATED" });
  return defaults;
}

export function validateSettingsInput(input: Partial<Settings>): void {
  validateBooleanField(input, "extensionEnabled");
  validateBooleanField(input, "hoverButtonEnabled");
  validateBooleanField(input, "showToast");
  validateBooleanField(input, "enableOnWorkDetailPage");

  if (
    input.hideWorkMode !== undefined &&
    input.hideWorkMode !== "collapse" &&
    input.hideWorkMode !== "hide"
  ) {
    throw new Error(`Invalid hideWorkMode: ${String(input.hideWorkMode)}`);
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
