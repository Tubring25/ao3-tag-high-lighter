import type { Settings } from "../core/types";

export async function getSettings(): Promise<Settings> {
  throw new Error("Not implemented: getSettings");
}

export async function saveSettings(settings: Settings): Promise<void> {
  void settings;
  throw new Error("Not implemented: saveSettings");
}
