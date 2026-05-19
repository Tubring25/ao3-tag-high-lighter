import type { MatchResult, ParsedWork, Rule, TagMatch, WorkMatchSummary } from "./types";
import { normalizeTagText } from "./normalize";
import { compileWildcardPattern } from "./wildcard";

interface PreparedRule {
  rule: Rule;
  normalizedPattern: string;
  wildcardRegex: RegExp | null;
}

export function matchRules(works: readonly ParsedWork[], rules: readonly Rule[]): MatchResult {
  const enabledRules = prepareRules(rules);
  const tagMatches: TagMatch[] = [];
  const workSummaries: WorkMatchSummary[] = [];

  for (const work of works) {
    const matchedRuleIds = new Set<string>();
    let hasWarn = false;
    let hasHideWork = false;

    for (const tag of work.tags) {
      for (const preparedRule of enabledRules) {
        const { rule } = preparedRule;
        if (rule.category !== "all" && rule.category !== tag.category) continue;

        const matched = testMatch(preparedRule, tag.normalizedText);

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

function prepareRules(rules: readonly Rule[]): PreparedRule[] {
  return rules
    .filter((rule) => rule.enabled)
    .map((rule) => {
      const normalizedPattern = normalizeTagText(rule.pattern);
      return {
        rule,
        normalizedPattern,
        wildcardRegex:
          rule.matchMode === "wildcard" ? compileWildcardPattern(normalizedPattern) : null,
      };
    });
}

function testMatch(preparedRule: PreparedRule, value: string): boolean {
  switch (preparedRule.rule.matchMode) {
    case "exact":
      return value === preparedRule.normalizedPattern;
    case "contains":
      return value.includes(preparedRule.normalizedPattern);
    case "wildcard":
      return preparedRule.wildcardRegex?.test(value) ?? false;
  }
}
