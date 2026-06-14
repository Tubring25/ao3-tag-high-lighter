import {
  addRule,
  deleteRule,
  deleteRules,
  getRule,
  listRules,
  toggleRule,
  updateRule,
  validateRuleInput,
} from "./ruleStorage";
import { STORAGE_KEY_RULES } from "../shared/constants";
import type { Rule } from "../core/types";

const store: Record<string, unknown> = {};
const sendMessage = vi.fn();

function createStoredRule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: "rule-1",
    pattern: "Slow Burn",
    action: "highlight",
    matchMode: "exact",
    category: "freeform",
    enabled: true,
    createdAt: 100,
    updatedAt: 100,
    ...overrides,
  };
}

describe("ruleStorage", () => {
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

  it("returns an empty list when no rules are stored", async () => {
    await expect(listRules()).resolves.toEqual([]);
  });

  it("returns an empty list when stored rules are malformed", async () => {
    store[STORAGE_KEY_RULES] = { bad: "data" };

    await expect(listRules()).resolves.toEqual([]);
  });

  it("returns an empty list when storage read fails", async () => {
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

    await expect(listRules()).resolves.toEqual([]);
  });

  it("filters out stored rules with removed or invalid actions", async () => {
    store[STORAGE_KEY_RULES] = [
      createStoredRule({ id: "valid-rule" }),
      createStoredRule({ id: "invalid-action-rule", action: "unsupported" as Rule["action"] }),
    ];

    await expect(listRules()).resolves.toEqual([createStoredRule({ id: "valid-rule" })]);
  });

  it("adds a rule with generated id and timestamps", async () => {
    vi.spyOn(Date, "now").mockReturnValue(12345);

    const rule = await addRule({
      pattern: "Slow Burn",
      action: "highlight",
      matchMode: "exact",
      category: "freeform",
      enabled: true,
      source: "quickAdd",
    });

    expect(rule).toEqual({
      id: expect.any(String),
      pattern: "Slow Burn",
      action: "highlight",
      matchMode: "exact",
      category: "freeform",
      enabled: true,
      source: "quickAdd",
      createdAt: 12345,
      updatedAt: 12345,
    });
    expect(store[STORAGE_KEY_RULES]).toEqual([rule]);
    expect(sendMessage).toHaveBeenCalledWith({ type: "RULES_UPDATED" });
  });

  it("rejects duplicate rules with the same normalized pattern, action, match mode, and category", async () => {
    store[STORAGE_KEY_RULES] = [
      createStoredRule({
        pattern: "  Slow   Burn ",
        action: "highlight",
        matchMode: "contains",
        category: "all",
      }),
    ];

    await expect(
      addRule({
        pattern: "slow burn",
        action: "highlight",
        matchMode: "contains",
        category: "all",
        enabled: true,
      })
    ).rejects.toThrow("Duplicate rule");
  });

  it("allows rules with the same pattern when action differs", async () => {
    const existing = createStoredRule({
      pattern: "Fluff",
      action: "highlight",
      matchMode: "contains",
      category: "all",
    });
    store[STORAGE_KEY_RULES] = [existing];

    const created = await addRule({
      pattern: "Fluff",
      action: "warn",
      matchMode: "contains",
      category: "all",
      enabled: true,
    });

    expect(store[STORAGE_KEY_RULES]).toEqual([existing, created]);
  });

  it("gets rules by id", async () => {
    const rule = createStoredRule();
    store[STORAGE_KEY_RULES] = [rule];

    await expect(getRule("rule-1")).resolves.toEqual(rule);
    await expect(getRule("missing")).resolves.toBeNull();
  });

  it("updates a rule while preserving createdAt and refreshing updatedAt", async () => {
    store[STORAGE_KEY_RULES] = [createStoredRule()];
    vi.spyOn(Date, "now").mockReturnValue(999);

    const updated = await updateRule("rule-1", {
      pattern: "Angst",
      action: "warn",
    });

    expect(updated).toEqual({
      id: "rule-1",
      pattern: "Angst",
      action: "warn",
      matchMode: "exact",
      category: "freeform",
      enabled: true,
      createdAt: 100,
      updatedAt: 999,
    });
    expect(store[STORAGE_KEY_RULES]).toEqual([updated]);
    expect(sendMessage).toHaveBeenCalledWith({ type: "RULES_UPDATED" });
  });

  it("rejects updates that would duplicate another rule", async () => {
    store[STORAGE_KEY_RULES] = [
      createStoredRule({ id: "rule-1", pattern: "Fluff", action: "highlight" }),
      createStoredRule({ id: "rule-2", pattern: "Angst", action: "warn" }),
    ];

    await expect(
      updateRule("rule-2", {
        pattern: "fluff",
        action: "highlight",
      })
    ).rejects.toThrow("Duplicate rule");
  });

  it("throws when updating a missing rule", async () => {
    await expect(updateRule("missing", { pattern: "Angst" })).rejects.toThrow(
      "Rule not found: missing"
    );
  });

  it("deletes a rule and treats missing ids as no-op", async () => {
    const kept = createStoredRule({ id: "rule-2" });
    store[STORAGE_KEY_RULES] = [createStoredRule(), kept];

    await deleteRule("rule-1");
    expect(store[STORAGE_KEY_RULES]).toEqual([kept]);

    await deleteRule("missing");
    expect(store[STORAGE_KEY_RULES]).toEqual([kept]);
  });

  it("deletes multiple rules in a single storage update", async () => {
    const kept = createStoredRule({ id: "rule-3", pattern: "Fluff" });
    store[STORAGE_KEY_RULES] = [
      createStoredRule({ id: "rule-1" }),
      createStoredRule({ id: "rule-2", pattern: "Angst" }),
      kept,
    ];

    await deleteRules(["rule-1", "rule-2", "missing"]);

    expect(store[STORAGE_KEY_RULES]).toEqual([kept]);
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith({ type: "RULES_UPDATED" });
  });

  it("toggles a rule enabled state", async () => {
    store[STORAGE_KEY_RULES] = [createStoredRule({ enabled: true })];
    vi.spyOn(Date, "now").mockReturnValue(456);

    const updated = await toggleRule("rule-1");

    expect(updated.enabled).toBe(false);
    expect(updated.updatedAt).toBe(456);
    expect(store[STORAGE_KEY_RULES]).toEqual([updated]);
  });

  it("throws when toggling a missing rule", async () => {
    await expect(toggleRule("missing")).rejects.toThrow("Rule not found: missing");
  });

  it("validates rule inputs", () => {
    expect(() => validateRuleInput({ pattern: "  " })).toThrow(
      "Rule pattern cannot be empty"
    );
    expect(() =>
      validateRuleInput({ pattern: "x", action: "bad" as Rule["action"] })
    ).toThrow("Invalid action: bad");
    expect(() =>
      validateRuleInput({ pattern: "x", action: "warn", matchMode: "bad" as Rule["matchMode"] })
    ).toThrow("Invalid matchMode: bad");
    expect(() =>
      validateRuleInput({
        pattern: "x",
        action: "warn",
        matchMode: "exact",
        category: "bad" as Rule["category"],
      })
    ).toThrow("Invalid category: bad");
  });

  it("keeps writes successful when update notification has no listener", async () => {
    sendMessage.mockRejectedValueOnce(new Error("No listener"));

    const rule = await addRule({
      pattern: "Fluff",
      action: "highlight",
      matchMode: "contains",
      category: "all",
      enabled: true,
    });

    expect(store[STORAGE_KEY_RULES]).toEqual([rule]);
  });
});
