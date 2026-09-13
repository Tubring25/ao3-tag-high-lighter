import { initBackgroundApp } from "./backgroundApp";
import { addRule, updateRule, deleteRule, deleteRules, toggleRule, listRules } from "../storage/ruleStorage";
import { saveSettings, resetSettings, getSettings } from "../storage/settingsStorage";
import { STORAGE_KEY_RULES, STORAGE_KEY_SETTINGS } from "../shared/constants";
import type { BackgroundMessageResponse } from "./backgroundApp";
import type { Rule } from "../core/types";

const input = (pattern: string) => ({ pattern, action: "highlight" as const, matchMode: "wildcard" as const, category: "all" as const, enabled: true });

function setup() {
  const store: Record<string, unknown> = {};
  let listener: (message: unknown, sender: unknown, respond: (response: BackgroundMessageResponse) => void) => boolean | void;
  const get = vi.fn(async (key: string) => {
    await new Promise((resolve) => setTimeout(resolve, 1));
    return structuredClone({ [key]: store[key] });
  });
  const set = vi.fn(async (items: Record<string, unknown>) => {
    await new Promise((resolve) => setTimeout(resolve, 1));
    Object.assign(store, structuredClone(items));
  });
  const channels: (boolean | void)[] = [];
  const sendMessage = vi.fn((message: { type: string }) => {
    if (message.type !== "STORAGE_MUTATION") return Promise.reject(new Error("No notification listener"));
    return new Promise((resolve) => {
      channels.push(listener(structuredClone(message), {}, resolve));
    });
  });
  vi.stubGlobal("chrome", {
    storage: { local: { get, set } },
    runtime: {
      sendMessage,
      onMessage: { addListener: vi.fn((callback) => { listener = callback; }) },
      onInstalled: { addListener: vi.fn() },
    },
    tabs: { query: vi.fn(async () => [{ id: 1 }]), sendMessage: vi.fn(async () => {}) },
  });
  initBackgroundApp();
  return { store, get, set, channels, sendMessage, restart: () => initBackgroundApp() };
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("background-owned storage mutations", () => {
  it("serializes concurrent clients, merges updates and settings, and keeps MV3 response channels open", async () => {
    const { store, channels } = setup();
    const rules = await Promise.all(Array.from({ length: 12 }, (_, index) => addRule(input(`tag-${index}`))));
    expect(store[STORAGE_KEY_RULES]).toHaveLength(12);
    await Promise.all([
      updateRule(rules[0].id, { pattern: "changed" }),
      updateRule(rules[0].id, { enabled: false }),
      updateRule(rules[1].id, { action: "warn" }),
      saveSettings({ extensionEnabled: false }),
      saveSettings({ hoverButtonEnabled: false }),
      saveSettings({ languagePreference: "en" }),
    ]);
    expect(await listRules()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: rules[0].id, pattern: "changed", enabled: false }),
      expect.objectContaining({ id: rules[1].id, action: "warn" }),
    ]));
    expect(await getSettings()).toMatchObject({ extensionEnabled: false, hoverButtonEnabled: false, languagePreference: "en" });
    await Promise.all([toggleRule(rules[0].id), toggleRule(rules[0].id), deleteRule(rules[1].id), deleteRules([rules[2].id, rules[3].id]), addRule(input("extra"))]);
    expect(await listRules()).toHaveLength(10);
    expect((await listRules())[0].enabled).toBe(false);
    expect(channels.every((channel) => channel === true)).toBe(true);
  });

  it("rejects every write on read failure, preserves bytes, and recovers after failure and worker restart", async () => {
    const { store, get, set, restart } = setup();
    const rule = await addRule(input("original"));
    await saveSettings({ extensionEnabled: false });
    const snapshot = structuredClone(store);
    set.mockClear();
    get.mockRejectedValue(new Error("read failed"));
    await expect(listRules()).resolves.toEqual([]);
    await expect(getSettings()).resolves.toMatchObject({ extensionEnabled: true });
    const results = await Promise.allSettled([
      addRule(input("new")), updateRule(rule.id, { pattern: "new" }), deleteRule(rule.id),
      deleteRules([rule.id]), toggleRule(rule.id), saveSettings({ showToast: false }), resetSettings(),
    ]);
    expect(results.every((result) => result.status === "rejected" && result.reason.message === "read failed")).toBe(true);
    expect(set).not.toHaveBeenCalled();
    expect(store).toEqual(snapshot);
    get.mockImplementation(async (key) => structuredClone({ [key]: store[key] }));
    await addRule(input("recovered"));
    restart();
    await addRule(input("after restart"));
    expect(store[STORAGE_KEY_RULES]).toHaveLength(3);
    expect(store[STORAGE_KEY_SETTINGS]).toEqual(snapshot[STORAGE_KEY_SETTINGS]);
  });

  it("does not overwrite malformed stored data or poison the queue after a failed write", async () => {
    const { store, set } = setup();
    store[STORAGE_KEY_RULES] = [{ pattern: "legacy-invalid" }];
    await expect(addRule(input("new"))).rejects.toThrow("Invalid stored rules");
    store[STORAGE_KEY_SETTINGS] = { extensionEnabled: "bad" };
    await expect(saveSettings({ showToast: false })).rejects.toThrow("Invalid extensionEnabled");
    await expect(resetSettings()).rejects.toThrow("Invalid extensionEnabled");
    expect(set).not.toHaveBeenCalled();
    delete store[STORAGE_KEY_RULES];
    set.mockRejectedValueOnce(new Error("write failed"));
    await expect(addRule(input("failed"))).rejects.toThrow("write failed");
    await addRule(input("success"));
    expect((store[STORAGE_KEY_RULES] as Rule[]).map((rule) => rule.pattern)).toEqual(["success"]);
  });

  it("checks duplicates against the latest data and orders resets with setting patches", async () => {
    setup();
    const results = await Promise.allSettled([addRule(input("same")), addRule(input("same"))]);
    expect(results.map((result) => result.status)).toEqual(["fulfilled", "rejected"]);
    expect(await listRules()).toHaveLength(1);
    await Promise.all([
      saveSettings({ extensionEnabled: false }),
      resetSettings(),
      saveSettings({ showToast: false }),
    ]);
    expect(await getSettings()).toMatchObject({ extensionEnabled: true, showToast: false });
  });

  it("fails closed when the background is unavailable", async () => {
    const { set, sendMessage } = setup();
    sendMessage.mockRejectedValue(new Error("worker unavailable"));
    await expect(addRule(input("new"))).rejects.toThrow("worker unavailable");
    expect(set).not.toHaveBeenCalled();
  });
});
