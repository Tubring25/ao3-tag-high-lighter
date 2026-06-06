import type { MatchResult, ParsedWork, RuleAction, TagMatch } from "../core/types";
import { resolveHighestPriorityAction } from "../core/priority";
import type { HitStats } from "../shared/message";

interface TagActionState {
  actions: RuleAction[];
}

export function calculateHitStats(
  matchResult: MatchResult | null,
  totalRules: number,
  works: readonly ParsedWork[] = []
): HitStats {
  const stats: HitStats = {
    highlight: 0,
    warn: 0,
    hideWork: 0,
    totalRules,
  };

  if (!matchResult) return stats;

  for (const action of resolveTagActions(matchResult.tagMatches).values()) {
    if (action === "highlight") {
      stats.highlight += 1;
    }
  }

  for (const summary of matchResult.workSummaries) {
    if (summary.hasWarn) {
      stats.warn += 1;
    }

    if (summary.hasHideWork) {
      stats.hideWork += 1;
    }
  }

  return stats;
}

function resolveTagActions(matches: readonly TagMatch[]): Map<string, RuleAction> {
  const grouped = new Map<string, TagActionState>();
  const resolved = new Map<string, RuleAction>();

  for (const match of matches) {
    const state = grouped.get(match.tagId) ?? { actions: [] };
    state.actions.push(match.action);
    grouped.set(match.tagId, state);
  }

  for (const [tagId, state] of grouped) {
    const action = resolveHighestPriorityAction(state.actions);
    if (action) {
      resolved.set(tagId, action);
    }
  }

  return resolved;
}
