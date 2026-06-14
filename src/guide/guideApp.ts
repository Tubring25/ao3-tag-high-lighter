import type { Settings } from "../core/types";
import { getSettings as defaultGetSettings } from "../storage/settingsStorage";
import { applyDocumentLanguage, setLanguagePreference, t } from "../shared/i18n";

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

export interface GuideAppDeps {
  getSettings(): Promise<Settings>;
}

export async function renderGuideApp(
  container: HTMLElement,
  deps: GuideAppDeps = createRealDeps()
): Promise<void> {
  const settings = await deps.getSettings();
  setLanguagePreference(settings.languagePreference);
  applyDocumentLanguage();

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
    eyebrow.textContent = t("guideEyebrow");

    const title = document.createElement("h1");
    title.textContent = t("guideTitle");

    const body = document.createElement("p");
    body.className = "guide-lede";
    body.textContent = t("guideLede");

    copy.append(eyebrow, title, body);

    const jump = document.createElement("a");
    jump.className = "guide-primary-link";
    jump.href = "options.html";
    jump.textContent = t("guideBackToOptions");

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
    title.textContent = t("guideControls");
    const hint = document.createElement("p");
    hint.textContent = t("guideControlsHint");
    builder.append(title, hint, createTagPicker(), createActionPicker());

    section.append(preview, builder);
    return section;
  }

  function createTagPicker(): HTMLElement {
    const group = createFieldGroup(t("guideTag"));
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
    const group = createFieldGroup(t("guideAction"));
    const actions = document.createElement("div");
    actions.className = "guide-segmented";

    for (const action of ["highlight", "warn", "hideWork"] as const) {
      const copy = getActionCopy(action);
      const button = document.createElement("button");
      button.type = "button";
      button.className = action === selectedAction ? "is-selected" : "";
      button.dataset.demoAction = action;
      button.textContent = copy.label;
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
    heading.textContent = t("guideMatchMode");

    const modes = document.createElement("div");
    modes.className = "guide-segmented";

    for (const mode of ["exact", "contains", "wildcard"] as const) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = mode === matchMode ? "is-selected" : "";
      button.dataset.demoMatchMode = mode;
      button.textContent = getMatchModeGuide(mode).label;
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
    const guide = getMatchModeGuide(matchMode);
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
      pattern.innerHTML = `<span>${t("guidePattern")}</span><code>${guide.pattern}</code>`;
      preview.appendChild(pattern);
    }
    preview.appendChild(summary);
    if (matchMode === "wildcard") {
      const cases = document.createElement("div");
      cases.className = "guide-wildcard-cases";
      for (const wildcardCase of getWildcardCases()) {
        cases.appendChild(createWildcardCase(wildcardCase));
      }
      preview.appendChild(cases);
    } else {
      preview.appendChild(createMatchSampleRow(t("guideMatches"), guide.examples, true));
      if (guide.misses.length > 0) {
        preview.appendChild(createMatchSampleRow(t("guideSkips"), guide.misses, false));
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

    caseBlock.append(pattern, createMatchSampleRow(t("guideMatches"), wildcardCase.examples, true));
    if (wildcardCase.misses.length > 0) {
      caseBlock.appendChild(createMatchSampleRow(t("guideSkips"), wildcardCase.misses, false));
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
    label.textContent = t("guideLivePreview");
    const active = document.createElement("strong");
    active.dataset.activeRuleLabel = "true";
    active.textContent = `${getActionCopy(selectedAction).button}: ${selectedTag.text}`;
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
    result.textContent = getActionCopy(selectedAction).result;

    const meta = document.createElement("dl");
    meta.className = "guide-meta";
    meta.innerHTML = `<dt>${t("guideMetaWords")}</dt><dd>242,931</dd><dt>${t("guideMetaChapters")}</dt><dd>50/50</dd><dt>${t("guideMetaKudos")}</dt><dd>24,330</dd>`;

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
    title.textContent = t("guideMatchingModesTitle");
    const body = document.createElement("p");
    body.textContent = t("guideMatchingModesBody");
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
    title.textContent = t("guideNextTitle");
    section.appendChild(title);

    const steps = [
      [t("guideStepAo3Title"), t("guideStepAo3Body")],
      [t("guideStepSafeTitle"), t("guideStepSafeBody")],
      [t("guideStepTuneTitle"), t("guideStepTuneBody")],
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
    if (selectedAction === "warn") return t("contentWarningMessage", [selectedTag.text]);
    if (selectedAction === "hideWork") return t("contentCollapsedOneReason", [selectedTag.text]);
    return "";
  }
}

function getActionCopy(action: DemoAction): { label: string; result: string; button: string } {
  if (action === "highlight") {
    return {
      label: t("actionHighlight"),
      result: t("guideResultHighlight"),
      button: t("actionHighlight"),
    };
  }

  if (action === "warn") {
    return {
      label: t("actionWarning"),
      result: t("guideResultWarn"),
      button: t("actionWarn"),
    };
  }

  return {
    label: t("actionCollapse"),
    result: t("guideResultCollapse"),
    button: t("actionCollapse"),
  };
}

function getMatchModeGuide(matchMode: MatchMode): MatchModeGuide {
  if (matchMode === "exact") {
    return {
      label: t("labelExact"),
      pattern: "Happy Ending",
      summary: t("guideExactSummary"),
      examples: ["Happy Ending"],
      misses: ["Happy Endings", "Angst with a Happy Ending"],
      bestFor: t("guideExactBestFor"),
    };
  }

  if (matchMode === "contains") {
    return {
      label: t("labelContains"),
      pattern: "Violence",
      summary: t("guideContainsSummary"),
      examples: ["Gun Violence", "depictions of violence"],
      misses: [],
      bestFor: t("guideContainsBestFor"),
    };
  }

  return {
    label: t("labelWildcard"),
    pattern: "*Lovers",
    summary: t("guideWildcardSummary"),
    examples: ["Enemies to Lovers", "Simps to Enemies to Lovers"],
    misses: ["Slow Burn", "Happy Ending"],
    bestFor: t("guideWildcardBestFor"),
  };
}

function getWildcardCases(): readonly WildcardCase[] {
  return [
    {
      label: t("guideTextBeforeStar"),
      pattern: "Enemies*",
      examples: ["Enemies to Lovers"],
      misses: ["Former Enemies to Lovers", "Simps to Enemies to Lovers"],
    },
    {
      label: t("guideTextAfterStar"),
      pattern: "*Lovers",
      examples: ["Enemies to Lovers", "Simps to Enemies to Lovers"],
      misses: ["Enemies to Lovers-ish", "Lovers to Enemies"],
    },
  ];
}

function createRealDeps(): GuideAppDeps {
  return {
    getSettings: defaultGetSettings,
  };
}
