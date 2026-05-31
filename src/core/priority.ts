import type { RuleAction } from "./types";

const ACTION_PRIORITY: Record<RuleAction, number> = {
  highlight: 1,
  warn: 2,
  hideWork: 3,
};

export function resolveHighestPriorityAction(actions: readonly RuleAction[]): RuleAction | null {
  if (actions.length === 0) return null;

  let best: RuleAction = actions[0];
  for (let i = 1; i < actions.length; i++) {
    if (ACTION_PRIORITY[actions[i]] > ACTION_PRIORITY[best]) {
      best = actions[i];
    }
  }
  return best;
}
