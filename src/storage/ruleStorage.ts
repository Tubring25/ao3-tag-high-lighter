import type { Rule } from "../core/types";
import { normalizeTagText } from "../core/normalize";
import { STORAGE_KEY_RULES } from "../shared/constants";
import type { RuntimeMessage } from "../shared/message";
import { generateId } from "../shared/utils";

const VALID_ACTIONS: readonly Rule["action"][] = ["highlight", "warn", "hideWork"];
const VALID_MATCH_MODES: readonly Rule["matchMode"][] = ["exact", "contains", "wildcard"];
const VALID_CATEGORIES: readonly Rule["category"][] = [
  "relationship",
  "character",
  "freeform",
  "all",
];

type RuleCreateInput = Omit<Rule, "id" | "createdAt" | "updatedAt">;
type RuleUpdateInput = Partial<Omit<Rule, "id" | "createdAt">>;

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

export async function listRules(): Promise<Rule[]> {
  try {
    const result = await getChrome().storage.local.get(STORAGE_KEY_RULES);
    const rules = result[STORAGE_KEY_RULES];
    return Array.isArray(rules) ? rules.filter(isValidStoredRule) : [];
  } catch {
    return [];
  }
}

export async function getRule(id: string): Promise<Rule | null> {
  const rules = await listRules();
  return rules.find((rule) => rule.id === id) ?? null;
}

export async function addRule(input: RuleCreateInput): Promise<Rule> {
  validateRuleInput(input);

  const rules = await listRules();
  assertNoDuplicateRule(input, rules);

  const now = Date.now();
  const rule: Rule = {
    ...input,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };

  await saveRules([...rules, rule]);
  await notifyUpdate({ type: "RULES_UPDATED" });
  return rule;
}

export async function updateRule(id: string, patch: RuleUpdateInput): Promise<Rule> {
  const rules = await listRules();
  const index = rules.findIndex((rule) => rule.id === id);
  if (index === -1) {
    throw new Error(`Rule not found: ${id}`);
  }

  const updated: Rule = {
    ...rules[index],
    ...patch,
    id: rules[index].id,
    createdAt: rules[index].createdAt,
    updatedAt: Date.now(),
  };

  validateRuleInput(updated);
  assertNoDuplicateRule(updated, rules, id);

  const nextRules = [...rules];
  nextRules[index] = updated;
  await saveRules(nextRules);
  await notifyUpdate({ type: "RULES_UPDATED" });
  return updated;
}

export async function deleteRule(id: string): Promise<void> {
  const rules = await listRules();
  const nextRules = rules.filter((rule) => rule.id !== id);
  await saveRules(nextRules);
  await notifyUpdate({ type: "RULES_UPDATED" });
}

export async function toggleRule(id: string): Promise<Rule> {
  const rules = await listRules();
  const index = rules.findIndex((rule) => rule.id === id);
  if (index === -1) {
    throw new Error(`Rule not found: ${id}`);
  }

  const updated: Rule = {
    ...rules[index],
    enabled: !rules[index].enabled,
    updatedAt: Date.now(),
  };

  const nextRules = [...rules];
  nextRules[index] = updated;
  await saveRules(nextRules);
  await notifyUpdate({ type: "RULES_UPDATED" });
  return updated;
}

export function validateRuleInput(input: Partial<Rule>): void {
  if (!input.pattern || input.pattern.trim() === "") {
    throw new Error("Rule pattern cannot be empty");
  }

  if (!VALID_ACTIONS.includes(input.action as Rule["action"])) {
    throw new Error(`Invalid action: ${String(input.action)}`);
  }

  if (!VALID_MATCH_MODES.includes(input.matchMode as Rule["matchMode"])) {
    throw new Error(`Invalid matchMode: ${String(input.matchMode)}`);
  }

  if (!VALID_CATEGORIES.includes(input.category as Rule["category"])) {
    throw new Error(`Invalid category: ${String(input.category)}`);
  }

  if (typeof input.enabled !== "boolean") {
    throw new Error("Invalid enabled: expected boolean");
  }
}

function isValidStoredRule(value: unknown): value is Rule {
  try {
    validateRuleInput(value as Partial<Rule>);
    return isObjectRecord(value) && typeof value.id === "string";
  } catch {
    return false;
  }
}

function assertNoDuplicateRule(
  candidate: Pick<Rule, "pattern" | "action" | "matchMode" | "category">,
  rules: readonly Rule[],
  ignoredRuleId?: string
): void {
  const duplicate = rules.find((rule) => {
    if (rule.id === ignoredRuleId) return false;
    return getRuleUniquenessKey(rule) === getRuleUniquenessKey(candidate);
  });

  if (duplicate) {
    throw new Error(`Duplicate rule: ${candidate.pattern}`);
  }
}

function getRuleUniquenessKey(
  rule: Pick<Rule, "pattern" | "action" | "matchMode" | "category">
): string {
  return [
    normalizeTagText(rule.pattern),
    rule.action,
    rule.matchMode,
    rule.category,
  ].join("\u0000");
}

async function saveRules(rules: readonly Rule[]): Promise<void> {
  await getChrome().storage.local.set({ [STORAGE_KEY_RULES]: [...rules] });
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
