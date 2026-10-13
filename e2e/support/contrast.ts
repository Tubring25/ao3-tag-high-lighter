import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

/** Elements the extension renders or recolors itself. */
export const EXTENSION_OWNED_SELECTORS = [
  "[data-ao3th-action]",
  "[data-ao3th-hovered]",
  ".ao3th-warn-banner",
  ".ao3th-detail-warning-bar",
  ".ao3th-detail-collapse-match-bar",
  ".ao3th-collapse-placeholder",
  ".ao3th-toast-container",
  "#ao3th-hover-host",
] as const;

export interface ContrastIssue {
  /** "fg on bg" color pair; stable across DOM shifts, unlike axe target selectors. */
  pair: string;
  ratio: number;
  target: string;
}

interface ColorContrastData {
  fgColor?: string;
  bgColor?: string;
  contrastRatio?: number;
}

/** WCAG AA color-contrast failures inside the given selectors (missing ones are skipped). */
export async function findContrastIssues(page: Page, selectors: readonly string[]): Promise<ContrastIssue[]> {
  const present: string[] = [];
  for (const selector of selectors) {
    if ((await page.locator(selector).count()) > 0) present.push(selector);
  }
  if (present.length === 0) return [];

  let builder = new AxeBuilder({ page }).withRules(["color-contrast"]);
  for (const selector of present) builder = builder.include(selector);
  const results = await builder.analyze();

  return results.violations.flatMap((violation) =>
    violation.nodes.map((node) => {
      const data = (node.any[0]?.data ?? {}) as ColorContrastData;
      return {
        pair: `${data.fgColor ?? "?"} on ${data.bgColor ?? "?"}`,
        ratio: data.contrastRatio ?? 0,
        target: node.target.join(" "),
      };
    })
  );
}

/** Issues whose color pair the skin did not already have without the extension. */
export function newIssuesComparedTo(baseline: readonly ContrastIssue[], current: readonly ContrastIssue[]): ContrastIssue[] {
  const knownPairs = new Set(baseline.map((issue) => issue.pair));
  return current.filter((issue) => !knownPairs.has(issue.pair));
}

export function describeIssues(issues: readonly ContrastIssue[]): string[] {
  const counts = new Map<string, { count: number; ratio: number; example: string }>();
  for (const issue of issues) {
    const entry = counts.get(issue.pair) ?? { count: 0, ratio: issue.ratio, example: issue.target };
    entry.count += 1;
    counts.set(issue.pair, entry);
  }
  return [...counts].map(([pair, { count, ratio, example }]) => `${count}× ${pair} (${ratio}:1), e.g. ${example}`);
}
