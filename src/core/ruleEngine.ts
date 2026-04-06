import type { MatchResult, ParsedWork, Rule, TagMatch, WorkMatchSummary } from "./types";
import { normalizeTagText } from "./normalize";
import { matchesWildcardPattern } from "./wildcard";

export function matchRules(works: readonly ParsedWork[], rules: readonly Rule[]): MatchResult {
  const enabledRules = rules.filter((r) => r.enabled);
  const tagMatches: TagMatch[] = [];
  const workSummaries: WorkMatchSummary[] = [];

  for (const work of works) {
    const matchedRuleIds = new Set<string>();
    let hasWarn = false;
    let hasHideWork = false;

    for (const tag of work.tags) {
      for (const rule of enabledRules) {
        if (rule.category !== "all" && rule.category !== tag.category) continue;

        const normalizedPattern = normalizeTagText(rule.pattern);
        const matched = testMatch(rule.matchMode, normalizedPattern, tag.normalizedText);

        if (matched) {
          tagMatches.push({ tagId: tag.id, ruleId: rule.id, action: rule.action });
          matchedRuleIds.add(rule.id);
          if (rule.action === "warn") hasWarn = true;
          if (rule.action === "hideWork") hasHideWork = true;
        }
      }
    }

    if (matchedRuleIds.size > 0) {
      workSummaries.push({
        workId: work.id,
        matchedRuleIds: [...matchedRuleIds],
        hasWarn,
        hasHideWork,
      });
    }
  }

  return { tagMatches, workSummaries };
}

function testMatch(mode: Rule["matchMode"], pattern: string, value: string): boolean {
  switch (mode) {
    case "exact":
      return value === pattern;
    case "contains":
      return value.includes(pattern);
    case "wildcard":
      return matchesWildcardPattern(pattern, value);
  }
}
