import { renderMatches } from "./renderer";
import type { MatchResult, ParsedTag, ParsedWork } from "../core/types";

function createWork(): ParsedWork {
  document.body.innerHTML = `
    <article id="work-1">
      <h4>Work title</h4>
      <a id="tag-1">Slow Burn</a>
      <a id="tag-2">Major Character Death</a>
    </article>
  `;

  const workElement = document.querySelector<HTMLElement>("#work-1");
  const tagOne = document.querySelector<HTMLElement>("#tag-1");
  const tagTwo = document.querySelector<HTMLElement>("#tag-2");

  if (!workElement || !tagOne || !tagTwo) {
    throw new Error("Test DOM failed to initialize");
  }

  return {
    id: "work-1",
    element: workElement,
    tags: [
      createTag("tag-1", "Slow Burn", "slow burn", tagOne),
      createTag("tag-2", "Major Character Death", "major character death", tagTwo),
    ],
  };
}

function createTag(id: string, text: string, normalizedText: string, element: HTMLElement): ParsedTag {
  return {
    id,
    text,
    normalizedText,
    category: "freeform",
    element,
    workId: "work-1",
  };
}

function createMatchResult(overrides: Partial<MatchResult>): MatchResult {
  return {
    tagMatches: [],
    workSummaries: [],
    ...overrides,
  };
}

describe("renderMatches", () => {
  it("applies highlight styling state to matching tags", () => {
    const work = createWork();

    renderMatches(
      [work],
      createMatchResult({
        tagMatches: [{ tagId: "tag-1", ruleId: "rule-highlight", action: "highlight" }],
      })
    );

    expect(work.tags[0].element.dataset.ao3thAction).toBe("highlight");
    expect(work.tags[0].element.dataset.ao3thRuleIds).toBe("rule-highlight");
  });

  it("applies mute styling state to matching tags", () => {
    const work = createWork();

    renderMatches(
      [work],
      createMatchResult({
        tagMatches: [{ tagId: "tag-1", ruleId: "rule-mute", action: "mute" }],
      })
    );

    expect(work.tags[0].element.dataset.ao3thAction).toBe("mute");
    expect(work.tags[0].element.dataset.ao3thRuleIds).toBe("rule-mute");
  });

  it("resolves multiple tag matches to the highest priority action", () => {
    const work = createWork();

    renderMatches(
      [work],
      createMatchResult({
        tagMatches: [
          { tagId: "tag-1", ruleId: "rule-mute", action: "mute" },
          { tagId: "tag-1", ruleId: "rule-warn", action: "warn" },
        ],
      })
    );

    expect(work.tags[0].element.dataset.ao3thAction).toBe("warn");
    expect(work.tags[0].element.dataset.ao3thRuleIds).toBe("rule-mute,rule-warn");
  });

  it("applies warn state to the work element", () => {
    const work = createWork();

    renderMatches(
      [work],
      createMatchResult({
        workSummaries: [
          {
            workId: "work-1",
            matchedRuleIds: ["rule-warn"],
            hasWarn: true,
            hasHideWork: false,
          },
        ],
      })
    );

    expect(work.element.dataset.ao3thWarn).toBe("true");
    expect(work.element.dataset.ao3thRuleIds).toBe("rule-warn");
  });

  it("collapses hideWork matches with a clickable placeholder by default", () => {
    const work = createWork();

    renderMatches(
      [work],
      createMatchResult({
        workSummaries: [
          {
            workId: "work-1",
            matchedRuleIds: ["rule-hide"],
            hasWarn: false,
            hasHideWork: true,
          },
        ],
      })
    );

    const placeholder = work.element.querySelector<HTMLButtonElement>(
      "[data-ao3th-collapse-placeholder]"
    );

    expect(work.element.dataset.ao3thHidden).toBe("collapse");
    expect(work.element.dataset.ao3thExpanded).toBeUndefined();
    expect(placeholder).toBeInstanceOf(HTMLButtonElement);
    expect(placeholder?.textContent).toContain("collapsed");

    placeholder?.click();

    expect(work.element.dataset.ao3thExpanded).toBe("true");
    expect(placeholder?.textContent).toContain("Hide again");
  });

  it("clears old render state before applying new matches", () => {
    const work = createWork();

    renderMatches(
      [work],
      createMatchResult({
        tagMatches: [{ tagId: "tag-1", ruleId: "rule-highlight", action: "highlight" }],
        workSummaries: [
          {
            workId: "work-1",
            matchedRuleIds: ["rule-hide"],
            hasWarn: true,
            hasHideWork: true,
          },
        ],
      })
    );

    renderMatches([work], createMatchResult({}));

    expect(work.tags[0].element.dataset.ao3thAction).toBeUndefined();
    expect(work.tags[0].element.dataset.ao3thRuleIds).toBeUndefined();
    expect(work.element.dataset.ao3thWarn).toBeUndefined();
    expect(work.element.dataset.ao3thHidden).toBeUndefined();
    expect(work.element.querySelector("[data-ao3th-collapse-placeholder]")).toBeNull();
  });

  it("preserves user-expanded collapse state when hideWork still matches after re-render", () => {
    const work = createWork();
    const hideMatch = createMatchResult({
      workSummaries: [
        {
          workId: "work-1",
          matchedRuleIds: ["rule-hide"],
          hasWarn: false,
          hasHideWork: true,
        },
      ],
    });

    renderMatches([work], hideMatch);
    work.element.querySelector<HTMLButtonElement>("[data-ao3th-collapse-placeholder]")?.click();

    renderMatches([work], hideMatch);

    expect(work.element.dataset.ao3thExpanded).toBe("true");
    expect(
      work.element.querySelector<HTMLButtonElement>("[data-ao3th-collapse-placeholder]")
        ?.textContent
    ).toContain("Hide again");
  });
});
