import type { Rule } from "../core/types";

export async function listRules(): Promise<Rule[]> {
  throw new Error("Not implemented: listRules");
}

export async function saveRule(rule: Rule): Promise<void> {
  void rule;
  throw new Error("Not implemented: saveRule");
}
