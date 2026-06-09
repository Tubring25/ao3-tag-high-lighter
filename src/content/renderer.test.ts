import { renderMatches } from "./renderer";
import type { MatchResult, ParsedTag, ParsedWork } from "../core/types";

function createWork(overrides: Partial<ParsedWork> = {}): ParsedWork {
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
    ...overrides,
  };
}

function createDetailWork(tagTexts: readonly string[] = ["Slow Burn", "Major Character Death"]): ParsedWork {
  document.body.innerHTML = `
    <div id="workskin">
      <dl class="work meta group">
        <dd class="freeform tags">
          <ul class="commas">
            ${tagTexts
              .map((tagText, index) => `<li><a id="detail-tag-${index}" class="tag">${tagText}</a></li>`)
              .join("")}
          </ul>
        </dd>
      </dl>
      <div id="chapters">
        <p id="article-copy">Original article content.</p>
      </div>
    </div>
  `;

  const workElement = document.querySelector<HTMLElement>("#workskin");
  if (!workElement) throw new Error("Test DOM failed to initialize");

  return {
    id: "work-1",
    element: workElement,
    tags: tagTexts.map((tagText, index) => {
      const tagElement = document.querySelector<HTMLElement>(`#detail-tag-${index}`);
      if (!tagElement) throw new Error("Test DOM failed to initialize");
      return createTag(
        `detail-tag-${index}`,
        tagText,
        tagText.toLowerCase(),
        tagElement
      );
    }),
    isWorkDetailPage: true,
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

  it("sets custom action style variables for content CSS", () => {
    const work = createWork();

    renderMatches(
      [work],
      createMatchResult({
        tagMatches: [{ tagId: "tag-1", ruleId: "rule-highlight", action: "highlight" }],
      }),
      {
        actionStyles: {
          highlight: {
            label: "Like",
            backgroundColor: "#fff4d8",
            textColor: "#5f3b00",
          },
          warn: {
            label: "Avoid",
            backgroundColor: "#f4e6e3",
            textColor: "#990000",
          },
        },
      }
    );

    expect(document.documentElement.style.getPropertyValue("--ao3th-highlight-bg")).toBe("#fff4d8");
    expect(document.documentElement.style.getPropertyValue("--ao3th-highlight-text")).toBe(
      "#5f3b00"
    );
    expect(document.documentElement.style.getPropertyValue("--ao3th-warn-bg")).toBe("#f4e6e3");
    expect(document.documentElement.style.getPropertyValue("--ao3th-warn-text")).toBe("#990000");
  });

  it("resolves multiple tag matches to the highest priority action", () => {
    const work = createWork();

    renderMatches(
      [work],
      createMatchResult({
        tagMatches: [
          { tagId: "tag-1", ruleId: "rule-highlight", action: "highlight" },
          { tagId: "tag-1", ruleId: "rule-warn", action: "warn" },
        ],
      })
    );

    expect(work.tags[0].element.dataset.ao3thAction).toBe("warn");
    expect(work.tags[0].element.dataset.ao3thRuleIds).toBe("rule-highlight,rule-warn");
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
    expect(work.element.querySelector("[data-ao3th-warn-banner]")?.textContent).toBe(
      "This work contains warning tags."
    );
  });

  it("does not insert a listing warn banner on work detail pages", () => {
    const work = createWork({ isWorkDetailPage: true });

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
    expect(work.element.querySelector("[data-ao3th-warn-banner]")).toBeNull();
  });

  it("collapses hideWork matches with a clickable placeholder by default", () => {
    const work = createWork();

    renderMatches(
      [work],
      createMatchResult({
        tagMatches: [{ tagId: "tag-2", ruleId: "rule-hide", action: "hideWork" }],
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
    expect(placeholder?.textContent).toContain(
      "This work is collapsed by a hideWork rule: Major Character Death"
    );

    placeholder?.click();

    expect(work.element.dataset.ao3thExpanded).toBe("true");
    expect(placeholder?.textContent).toContain("Hide again");

    placeholder?.click();

    expect(work.element.dataset.ao3thExpanded).toBeUndefined();
    expect(placeholder?.textContent).toContain("Click to expand");
  });

  it("lists every hideWork reason on collapsed works", () => {
    const work = createWork();

    renderMatches(
      [work],
      createMatchResult({
        tagMatches: [
          { tagId: "tag-1", ruleId: "rule-hide-1", action: "hideWork" },
          { tagId: "tag-2", ruleId: "rule-hide-2", action: "hideWork" },
        ],
        workSummaries: [
          {
            workId: "work-1",
            matchedRuleIds: ["rule-hide-1", "rule-hide-2"],
            hasWarn: false,
            hasHideWork: true,
          },
        ],
      })
    );

    const placeholder = work.element.querySelector<HTMLButtonElement>(
      "[data-ao3th-collapse-placeholder]"
    );

    expect(placeholder?.textContent).toContain(
      "This work is collapsed by hideWork rules: Slow Burn, Major Character Death"
    );
  });

  it("toggles collapsed work without causing child-list mutations", async () => {
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
    const observerCallback = vi.fn();
    const observer = new MutationObserver(observerCallback);
    observer.observe(work.element, { childList: true, subtree: true });

    placeholder?.click();
    await flushMutationObserver();

    observer.disconnect();
    expect(observerCallback).not.toHaveBeenCalled();
    expect(work.element.dataset.ao3thExpanded).toBe("true");
  });

  it("does not collapse hideWork matches on work detail pages", () => {
    const work = createWork({ isWorkDetailPage: true });

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

    expect(work.element.dataset.ao3thHidden).toBeUndefined();
    expect(work.element.hidden).toBe(false);
    expect(work.element.querySelector("[data-ao3th-collapse-placeholder]")).toBeNull();
  });

  it("shows warning and caution bars inside detail page metadata without changing article content", () => {
    const work = createDetailWork();

    renderMatches(
      [work],
      createMatchResult({
        tagMatches: [
          { tagId: "detail-tag-0", ruleId: "rule-warn", action: "warn" },
          { tagId: "detail-tag-1", ruleId: "rule-hide", action: "hideWork" },
        ],
        workSummaries: [
          {
            workId: "work-1",
            matchedRuleIds: ["rule-warn", "rule-hide"],
            hasWarn: true,
            hasHideWork: true,
          },
        ],
      })
    );

    const meta = work.element.querySelector("dl.work.meta");
    const articleCopy = work.element.querySelector("#article-copy");

    expect(meta?.querySelector("[data-ao3th-warn-banner]")?.textContent).toBe(
      "This work contains warning tags: Slow Burn."
    );
    expect(meta?.querySelector("[data-ao3th-caution-banner]")?.textContent).toBe(
      "Caution: This work matches tags you usually hide from listings: Major Character Death."
    );
    expect(work.tags[1].element.dataset.ao3thAction).toBe("hideWork");
    expect(work.element.querySelector("[data-ao3th-collapse-placeholder]")).toBeNull();
    expect(work.element.dataset.ao3thHidden).toBeUndefined();
    expect(articleCopy?.textContent).toBe("Original article content.");
    expect(articleCopy?.querySelector("[data-ao3th-warn-banner]")).toBeNull();
    expect(articleCopy?.querySelector("[data-ao3th-caution-banner]")).toBeNull();
  });

  it("does not show a detail warning bar when five or more warning tags match", () => {
    const work = createDetailWork(["One", "Two", "Three", "Four", "Five", "Major Character Death"]);

    renderMatches(
      [work],
      createMatchResult({
        tagMatches: [
          { tagId: "detail-tag-0", ruleId: "rule-warn-1", action: "warn" },
          { tagId: "detail-tag-1", ruleId: "rule-warn-2", action: "warn" },
          { tagId: "detail-tag-2", ruleId: "rule-warn-3", action: "warn" },
          { tagId: "detail-tag-3", ruleId: "rule-warn-4", action: "warn" },
          { tagId: "detail-tag-4", ruleId: "rule-warn-5", action: "warn" },
          { tagId: "detail-tag-5", ruleId: "rule-hide", action: "hideWork" },
        ],
        workSummaries: [
          {
            workId: "work-1",
            matchedRuleIds: [
              "rule-warn-1",
              "rule-warn-2",
              "rule-warn-3",
              "rule-warn-4",
              "rule-warn-5",
              "rule-hide",
            ],
            hasWarn: true,
            hasHideWork: true,
          },
        ],
      })
    );

    const meta = work.element.querySelector("dl.work.meta");

    expect(meta?.querySelector("[data-ao3th-warn-banner]")).toBeNull();
    expect(meta?.querySelector("[data-ao3th-caution-banner]")?.textContent).toBe(
      "Caution: This work matches tags you usually hide from listings: Major Character Death."
    );
  });

  it("clears detail page metadata bars before re-rendering", () => {
    const work = createDetailWork();

    renderMatches(
      [work],
      createMatchResult({
        tagMatches: [
          { tagId: "detail-tag-0", ruleId: "rule-warn", action: "warn" },
          { tagId: "detail-tag-1", ruleId: "rule-hide", action: "hideWork" },
        ],
        workSummaries: [
          {
            workId: "work-1",
            matchedRuleIds: ["rule-warn", "rule-hide"],
            hasWarn: true,
            hasHideWork: true,
          },
        ],
      })
    );

    renderMatches([work], createMatchResult({}));

    const meta = work.element.querySelector("dl.work.meta");
    expect(meta?.querySelector("[data-ao3th-warn-banner]")).toBeNull();
    expect(meta?.querySelector("[data-ao3th-caution-banner]")).toBeNull();
  });

  it("keeps hideWork tag background on work detail pages", () => {
    const work = createWork({ isWorkDetailPage: true });

    renderMatches(
      [work],
      createMatchResult({
        tagMatches: [
          { tagId: "tag-1", ruleId: "rule-highlight", action: "highlight" },
          { tagId: "tag-1", ruleId: "rule-hide", action: "hideWork" },
        ],
      })
    );

    expect(work.tags[0].element.dataset.ao3thAction).toBe("hideWork");
    expect(work.tags[0].element.dataset.ao3thRuleIds).toBe("rule-highlight,rule-hide");
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
    expect(work.element.querySelector("[data-ao3th-warn-banner]")).toBeNull();
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

async function flushMutationObserver(): Promise<void> {
  for (let i = 0; i < 3; i += 1) {
    await Promise.resolve();
  }
}
