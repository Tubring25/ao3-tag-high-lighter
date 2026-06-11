type DemoAction = "highlight" | "warn" | "hideWork";
type DemoCategory = "relationship" | "character" | "freeform";
type MatchMode = "exact" | "contains" | "wildcard";

interface DemoTag {
  text: string;
  category: DemoCategory;
}

interface MatchModeGuide {
  label: string;
  pattern: string;
  summary: string;
  examples: readonly string[];
  misses: readonly string[];
  bestFor: string;
}

interface WildcardCase {
  label: string;
  pattern: string;
  examples: readonly string[];
  misses: readonly string[];
}

const DEMO_TAGS: readonly DemoTag[] = [
  { text: "Firefighter Vi", category: "freeform" },
  { text: "Detective Caitlyn", category: "freeform" },
  { text: "Enemies to Lovers", category: "freeform" },
  { text: "More Like Moderately Hostile to Lovers", category: "freeform" },
  { text: "Simps to Enemies to Lovers", category: "freeform" },
  { text: "Slow Burn", category: "freeform" },
  { text: "Gun Violence", category: "freeform" },
  { text: "Happy Ending", category: "freeform" },
];

const DEMO_WORK_URL = "https://archiveofourown.org/works/40752774/chapters/102115695";

const ACTION_COPY: Record<DemoAction, { label: string; result: string; button: string }> = {
  highlight: {
    label: "Highlight",
    result: "The tag gets a quiet color marker so it is easy to scan.",
    button: "Highlight",
  },
  warn: {
    label: "Warning",
    result: "The work stays visible, with a warning bar above the metadata.",
    button: "Warn",
  },
  hideWork: {
    label: "Collapse",
    result: "The work collapses on listing pages and shows the matched reason.",
    button: "Collapse",
  },
};

const MATCH_MODE_GUIDES: Record<MatchMode, MatchModeGuide> = {
  exact: {
    label: "Exact",
    pattern: "Happy Ending",
    summary: "Matches the whole AO3 tag only.",
    examples: ["Happy Ending"],
    misses: ["Happy Endings", "Angst with a Happy Ending"],
    bestFor: "Best first choice for copied AO3 tags.",
  },
  contains: {
    label: "Contains",
    pattern: "Violence",
    summary: "Matches tags that include this word or phrase.",
    examples: ["Gun Violence", "depictions of violence"],
    misses: [],
    bestFor: "Use for broad themes that appear in many tag names.",
  },
  wildcard: {
    label: "Wildcard",
    pattern: "*Lovers",
    summary: "Use * when part of the tag may change.",
    examples: ["Enemies to Lovers", "Simps to Enemies to Lovers"],
    misses: ["Slow Burn", "Happy Ending"],
    bestFor: "Use when the beginning or ending may vary.",
  },
};

const WILDCARD_CASES: readonly WildcardCase[] = [
  {
    label: "Text before *",
    pattern: "Enemies*",
    examples: ["Enemies to Lovers"],
    misses: ["Former Enemies to Lovers", "Simps to Enemies to Lovers"],
  },
  {
    label: "Text after *",
    pattern: "*Lovers",
    examples: ["Enemies to Lovers", "Simps to Enemies to Lovers"],
    misses: ["Enemies to Lovers-ish", "Lovers to Enemies"],
  },
];

export function renderGuideApp(container: HTMLElement): void {
  let selectedTag = DEMO_TAGS[0];
  let selectedAction: DemoAction = "highlight";
  let matchMode: MatchMode = "exact";

  container.textContent = "";
  const shell = document.createElement("main");
  shell.className = "guide-shell";

  shell.append(createHero(), createDemo(), createMatchingGuide(), createNextSteps());
  container.appendChild(shell);

  function createHero(): HTMLElement {
    const hero = document.createElement("section");
    hero.className = "guide-hero";

    const copy = document.createElement("div");
    const eyebrow = document.createElement("p");
    eyebrow.className = "guide-eyebrow";
    eyebrow.textContent = "AO3 Tag Highlighter Guide";

    const title = document.createElement("h1");
    title.textContent = "See what a tag rule changes.";

    const body = document.createElement("p");
    body.className = "guide-lede";
    body.textContent = "Try the preview, then read the rule basics below.";

    copy.append(eyebrow, title, body);

    const jump = document.createElement("a");
    jump.className = "guide-primary-link";
    jump.href = "#demo";
    jump.textContent = "Try it";

    hero.append(copy, jump);
    return hero;
  }

  function createDemo(): HTMLElement {
    const section = document.createElement("section");
    section.id = "demo";
    section.className = "guide-demo";

    const preview = document.createElement("div");
    preview.className = "guide-preview";
    preview.dataset.guidePreview = "true";
    renderPreview(preview);

    const builder = document.createElement("aside");
    builder.className = "guide-builder";

    const title = document.createElement("h2");
    title.textContent = "Controls";
    const hint = document.createElement("p");
    hint.textContent = "Adjust the sample rule.";
    builder.append(title, hint, createTagPicker(), createActionPicker());

    section.append(preview, builder);
    return section;
  }

  function createTagPicker(): HTMLElement {
    const group = createFieldGroup("Tag");
    const tagList = document.createElement("div");
    tagList.className = "guide-tag-list";

    for (const tag of DEMO_TAGS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className =
        tag.text === selectedTag.text ? `guide-tag is-selected is-${selectedAction}` : "guide-tag";
      button.dataset.demoTag = tag.text;
      button.textContent = tag.text;
      button.addEventListener("click", () => {
        selectedTag = tag;
        rerenderDemo();
      });
      tagList.appendChild(button);
    }

    group.appendChild(tagList);
    return group;
  }

  function createActionPicker(): HTMLElement {
    const group = createFieldGroup("Action");
    const actions = document.createElement("div");
    actions.className = "guide-segmented";

    for (const action of ["highlight", "warn", "hideWork"] as const) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = action === selectedAction ? "is-selected" : "";
      button.dataset.demoAction = action;
      button.textContent = ACTION_COPY[action].label;
      button.addEventListener("click", () => {
        selectedAction = action;
        rerenderDemo();
      });
      actions.appendChild(button);
    }

    group.appendChild(actions);
    return group;
  }

  function createMatchPicker(): HTMLElement {
    const group = document.createElement("section");
    group.className = "guide-field-group guide-match-field-group";

    const sidebar = document.createElement("div");
    sidebar.className = "guide-match-mode-sidebar";

    const heading = document.createElement("h3");
    heading.textContent = "Match mode";

    const modes = document.createElement("div");
    modes.className = "guide-segmented";

    for (const mode of ["exact", "contains", "wildcard"] as const) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = mode === matchMode ? "is-selected" : "";
      button.dataset.demoMatchMode = mode;
      button.textContent = MATCH_MODE_GUIDES[mode].label;
      button.addEventListener("click", () => {
        matchMode = mode;
        rerenderDemo();
        rerenderMatchingGuide();
      });
      modes.appendChild(button);
    }

    sidebar.append(heading, modes);
    group.append(sidebar, createMatchModePreview());
    return group;
  }

  function createMatchModePreview(): HTMLElement {
    const guide = MATCH_MODE_GUIDES[matchMode];
    const preview = document.createElement("div");
    preview.className = "guide-match-preview";
    preview.dataset.matchModePreview = matchMode;

    const summary = document.createElement("p");
    summary.className = "guide-field-hint";
    summary.textContent = guide.summary;

    const bestFor = document.createElement("p");
    bestFor.className = "guide-match-best";
    bestFor.textContent = guide.bestFor;

    if (matchMode !== "wildcard") {
      const pattern = document.createElement("p");
      pattern.className = "guide-match-pattern";
      pattern.innerHTML = `<span>Pattern</span><code>${guide.pattern}</code>`;
      preview.appendChild(pattern);
    }
    preview.appendChild(summary);
    if (matchMode === "wildcard") {
      const cases = document.createElement("div");
      cases.className = "guide-wildcard-cases";
      for (const wildcardCase of WILDCARD_CASES) {
        cases.appendChild(createWildcardCase(wildcardCase));
      }
      preview.appendChild(cases);
    } else {
      preview.appendChild(createMatchSampleRow("Matches", guide.examples, true));
      if (guide.misses.length > 0) {
        preview.appendChild(createMatchSampleRow("Skips", guide.misses, false));
      }
    }
    preview.appendChild(bestFor);
    return preview;
  }

  function createWildcardCase(wildcardCase: WildcardCase): HTMLElement {
    const caseBlock = document.createElement("section");
    caseBlock.className = "guide-wildcard-case";

    const pattern = document.createElement("p");
    pattern.className = "guide-match-pattern";
    pattern.innerHTML = `<span>${wildcardCase.label}</span><code>${wildcardCase.pattern}</code>`;

    caseBlock.append(pattern, createMatchSampleRow("Matches", wildcardCase.examples, true));
    if (wildcardCase.misses.length > 0) {
      caseBlock.appendChild(createMatchSampleRow("Skips", wildcardCase.misses, false));
    }
    return caseBlock;
  }

  function createMatchSampleRow(label: string, tags: readonly string[], isMatch: boolean): HTMLElement {
    const row = document.createElement("div");
    row.className = "guide-match-sample-row";

    const rowLabel = document.createElement("span");
    rowLabel.textContent = label;

    const list = document.createElement("ul");
    for (const tag of tags) {
      const item = document.createElement("li");
      item.className = isMatch ? "is-match" : "is-miss";
      item.textContent = tag;
      list.appendChild(item);
    }

    row.append(rowLabel, list);
    return row;
  }

  function renderPreview(preview: HTMLElement): void {
    preview.textContent = "";

    const top = document.createElement("div");
    top.className = "guide-preview-top";
    const label = document.createElement("p");
    label.textContent = "Live AO3-style preview";
    const active = document.createElement("strong");
    active.dataset.activeRuleLabel = "true";
    active.textContent = `${ACTION_COPY[selectedAction].button}: ${selectedTag.text}`;
    top.append(label, active);

    const work = document.createElement("article");
    work.className = getWorkClassName(selectedAction);

    const banner = document.createElement("div");
    banner.className = "guide-work-banner";
    banner.textContent = getBannerText();

    const heading = document.createElement("h3");
    heading.innerHTML = `<a href="${DEMO_WORK_URL}">Hotshot</a> <span>by SarcastCity</span>`;

    const tags = document.createElement("p");
    tags.className = "guide-work-tags";
    for (const tag of DEMO_TAGS) {
      const tagElement = document.createElement("button");
      tagElement.type = "button";
      tagElement.className = getTagClassName(tag);
      tagElement.textContent = tag.text;
      tagElement.addEventListener("click", () => {
        selectedTag = tag;
        rerenderDemo();
      });
      tags.append(tagElement, " ");
    }

    const result = document.createElement("p");
    result.className = "guide-result-copy";
    result.textContent = ACTION_COPY[selectedAction].result;

    const meta = document.createElement("dl");
    meta.className = "guide-meta";
    meta.innerHTML = "<dt>Words</dt><dd>242,931</dd><dt>Chapters</dt><dd>50/50</dd><dt>Kudos</dt><dd>24,330</dd>";

    if (selectedAction !== "highlight") work.appendChild(banner);
    work.append(heading, tags, result, meta);
    preview.append(top, work);
  }

  function createMatchingGuide(): HTMLElement {
    const section = document.createElement("section");
    section.className = "guide-matching";

    const header = document.createElement("div");
    header.className = "guide-section-header";
    const title = document.createElement("h2");
    title.textContent = "Matching modes";
    const body = document.createElement("p");
    body.textContent = "Choose how closely a rule pattern should match AO3 tag text.";
    header.append(title, body);

    const control = document.createElement("div");
    control.className = "guide-match-mode-control";
    control.appendChild(createMatchPicker());

    section.append(header, control);
    return section;
  }

  function createNextSteps(): HTMLElement {
    const section = document.createElement("section");
    section.className = "guide-next";

    const title = document.createElement("h2");
    title.textContent = "What to do next";
    section.appendChild(title);

    const steps = [
      ["On AO3", "Hover a tag, click +, then choose Highlight, Warning, or Collapse."],
      ["Start safe", "Use Exact for copied AO3 tags. Try Contains or Wildcard only when you need broader matches."],
      ["Tune later", "Use Manage rules to edit colors, pause rules, or change match modes."],
    ] as const;

    const list = document.createElement("ol");
    for (const [stepTitle, text] of steps) {
      const item = document.createElement("li");
      item.innerHTML = `<strong>${stepTitle}</strong><span>${text}</span>`;
      list.appendChild(item);
    }
    section.appendChild(list);
    return section;
  }

  function createFieldGroup(label: string): HTMLElement {
    const group = document.createElement("section");
    group.className = "guide-field-group";
    const heading = document.createElement("h3");
    heading.textContent = label;
    group.appendChild(heading);
    return group;
  }

  function rerenderDemo(): void {
    const demo = shell.querySelector(".guide-demo");
    if (!demo) return;
    demo.replaceWith(createDemo());
  }

  function rerenderMatchingGuide(): void {
    const matching = shell.querySelector(".guide-matching");
    if (!matching) return;
    matching.replaceWith(createMatchingGuide());
  }

  function getTagClassName(tag: DemoTag): string {
    const classes = ["guide-work-tag"];
    if (tag.text === selectedTag.text) classes.push(`is-${selectedAction}`);
    return classes.join(" ");
  }

  function getWorkClassName(action: DemoAction): string {
    return action === "highlight" ? "guide-work-card" : `guide-work-card is-${action}`;
  }

  function getBannerText(): string {
    if (selectedAction === "warn") return `This work contains warning tags: ${selectedTag.text}.`;
    if (selectedAction === "hideWork") return `This work is collapsed by a hideWork rule: ${selectedTag.text}.`;
    return "";
  }
}
