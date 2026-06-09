type DemoAction = "highlight" | "warn" | "hideWork";
type DemoCategory = "relationship" | "character" | "freeform";
type MatchMode = "exact" | "contains" | "wildcard";

interface DemoTag {
  text: string;
  category: DemoCategory;
}

interface DemoRule {
  pattern: string;
  action: DemoAction;
  category: DemoCategory;
  matchMode: MatchMode;
}

const DEMO_TAGS: readonly DemoTag[] = [
  { text: "Slow Burn", category: "freeform" },
  { text: "Hurt/Comfort", category: "freeform" },
  { text: "Major Character Death", category: "freeform" },
  { text: "Aziraphale/Crowley", category: "relationship" },
  { text: "Alternate Universe", category: "freeform" },
];

const QUICK_EXAMPLES: readonly DemoRule[] = [
  { pattern: "Slow Burn", action: "highlight", category: "freeform", matchMode: "exact" },
  { pattern: "Hurt/Comfort", action: "warn", category: "freeform", matchMode: "exact" },
  { pattern: "Major Character Death", action: "hideWork", category: "freeform", matchMode: "exact" },
];

const ACTION_COPY: Record<DemoAction, { label: string; result: string; button: string }> = {
  highlight: {
    label: "Highlight tag",
    result: "The matching tag gets a readable color marker.",
    button: "Highlight",
  },
  warn: {
    label: "Warning",
    result: "The work keeps showing, with a warning bar above the metadata.",
    button: "Warn",
  },
  hideWork: {
    label: "Collapse work",
    result: "The listing item collapses into a short bar with the matched reason.",
    button: "Collapse",
  },
};

export function renderGuideApp(container: HTMLElement): void {
  let selectedTag = DEMO_TAGS[0];
  let selectedAction: DemoAction = "highlight";
  let matchMode: MatchMode = "exact";
  let createdRules: DemoRule[] = [];

  container.textContent = "";
  const shell = document.createElement("main");
  shell.className = "guide-shell";

  shell.append(createHero(), createDemo(), createSteps(), createTips());
  container.appendChild(shell);

  function createHero(): HTMLElement {
    const hero = document.createElement("section");
    hero.className = "guide-hero";

    const copy = document.createElement("div");
    const eyebrow = document.createElement("p");
    eyebrow.className = "guide-eyebrow";
    eyebrow.textContent = "AO3 Tag Highlighter Guide";

    const title = document.createElement("h1");
    title.textContent = "Mark the tags you care about before you open a work.";

    const body = document.createElement("p");
    body.className = "guide-lede";
    body.textContent =
      "Use rules to highlight favorite tags, show warnings, or collapse works from AO3 listing pages.";

    copy.append(eyebrow, title, body);

    const jump = document.createElement("a");
    jump.className = "guide-primary-link";
    jump.href = "#demo";
    jump.textContent = "Try the example";

    hero.append(copy, jump);
    return hero;
  }

  function createDemo(): HTMLElement {
    const section = document.createElement("section");
    section.id = "demo";
    section.className = "guide-demo";

    const builder = document.createElement("div");
    builder.className = "guide-builder";

    const title = document.createElement("h2");
    title.textContent = "Build a sample rule";
    const hint = document.createElement("p");
    hint.textContent = "Pick a tag, choose what happens, then add it to the example list.";
    builder.append(title, hint, createTagPicker(), createActionPicker(), createModePicker(), createCreateButton());

    const preview = document.createElement("div");
    preview.className = "guide-preview";
    preview.dataset.guidePreview = "true";

    section.append(builder, preview);
    renderPreview(preview);
    return section;
  }

  function createTagPicker(): HTMLElement {
    const group = createFieldGroup("1", "Choose a tag from the AO3-style work block");
    const tagList = document.createElement("div");
    tagList.className = "guide-tag-list";

    for (const tag of DEMO_TAGS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = tag.text === selectedTag.text ? "guide-tag is-selected" : "guide-tag";
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
    const group = createFieldGroup("2", "Choose how matching works should change");
    const actions = document.createElement("div");
    actions.className = "guide-action-grid";

    for (const action of ["highlight", "warn", "hideWork"] as const) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = action === selectedAction ? "guide-action-card is-selected" : "guide-action-card";
      button.dataset.demoAction = action;
      button.innerHTML = `<strong>${ACTION_COPY[action].label}</strong><span>${ACTION_COPY[action].result}</span>`;
      button.addEventListener("click", () => {
        selectedAction = action;
        rerenderDemo();
      });
      actions.appendChild(button);
    }

    group.appendChild(actions);
    return group;
  }

  function createModePicker(): HTMLElement {
    const group = createFieldGroup("3", "Set how strict the match should be");
    const modes = document.createElement("div");
    modes.className = "guide-segmented";

    for (const mode of ["exact", "contains", "wildcard"] as const) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = mode === matchMode ? "is-selected" : "";
      button.dataset.demoMatchMode = mode;
      button.textContent = mode === "exact" ? "Exact" : mode === "contains" ? "Contains" : "Wildcard";
      button.addEventListener("click", () => {
        matchMode = mode;
        rerenderDemo();
      });
      modes.appendChild(button);
    }

    group.appendChild(modes);
    return group;
  }

  function createCreateButton(): HTMLElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "guide-create-rule";
    button.dataset.createDemoRule = "true";
    button.textContent = "Add example rule";
    button.addEventListener("click", () => {
      const nextRule: DemoRule = {
        pattern: selectedTag.text,
        category: selectedTag.category,
        action: selectedAction,
        matchMode,
      };
      createdRules = [nextRule, ...createdRules.filter((rule) => rule.pattern !== nextRule.pattern)].slice(0, 4);
      rerenderDemo();
    });
    return button;
  }

  function renderPreview(preview: HTMLElement): void {
    preview.textContent = "";

    const top = document.createElement("div");
    top.className = "guide-preview-top";
    const label = document.createElement("p");
    label.textContent = "Live example";
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
    heading.innerHTML = `<a href="#demo">The Cartographer's Shortcut</a> <span>by samplewriter</span>`;

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

    const summary = document.createElement("p");
    summary.className = "guide-summary";
    summary.textContent =
      "A compact listing-page preview showing how the selected rule changes an AO3 work before you open it.";

    const meta = document.createElement("dl");
    meta.className = "guide-meta";
    meta.innerHTML = "<dt>Words</dt><dd>24,180</dd><dt>Chapters</dt><dd>8/8</dd><dt>Kudos</dt><dd>1,204</dd>";

    if (selectedAction !== "highlight") work.appendChild(banner);
    work.append(heading, tags, summary, meta);

    const rules = document.createElement("div");
    rules.className = "guide-rule-list";
    const rulesTitle = document.createElement("h3");
    rulesTitle.textContent = "Example rules";
    rules.appendChild(rulesTitle);

    const list = document.createElement("ul");
    const rulesToShow = createdRules.length > 0 ? createdRules : QUICK_EXAMPLES;
    for (const rule of rulesToShow) {
      const item = document.createElement("li");
      item.innerHTML = `<strong>${ACTION_COPY[rule.action].button}</strong><span>${rule.pattern} · ${rule.matchMode} · ${rule.category}</span>`;
      list.appendChild(item);
    }
    rules.appendChild(list);

    preview.append(top, work, rules);
  }

  function createSteps(): HTMLElement {
    const section = document.createElement("section");
    section.className = "guide-steps";

    const title = document.createElement("h2");
    title.textContent = "Use it on AO3";
    section.appendChild(title);

    const steps = [
      ["Hover a tag", "On AO3 listing pages, move your cursor over a relationship, character, or freeform tag."],
      ["Click +", "The quick-add menu opens for that exact tag. The selected tag stays locked while the menu is open."],
      ["Choose an action", "Highlight a tag, mark the work with a warning, or collapse the work from listings."],
      ["Adjust later", "Open Manage rules to edit patterns, match modes, categories, colors, and paused rules."],
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

  function createTips(): HTMLElement {
    const section = document.createElement("section");
    section.className = "guide-tips";

    const title = document.createElement("h2");
    title.textContent = "Good first rules";
    const cards = document.createElement("div");
    cards.className = "guide-tip-grid";

    const tips = [
      ["Start exact", "Use Exact for tags copied from AO3. It avoids surprising matches."],
      ["Use contains carefully", "Contains works well for broad ideas like Vampire or Time Travel."],
      ["Collapse only hard skips", "Collapse hides listing content until you expand it, so reserve it for tags you always avoid."],
    ] as const;

    for (const [tipTitle, text] of tips) {
      const card = document.createElement("article");
      card.innerHTML = `<h3>${tipTitle}</h3><p>${text}</p>`;
      cards.appendChild(card);
    }

    section.append(title, cards);
    return section;
  }

  function createFieldGroup(number: string, label: string): HTMLElement {
    const group = document.createElement("section");
    group.className = "guide-field-group";
    const heading = document.createElement("h3");
    heading.innerHTML = `<span>${number}</span>${label}`;
    group.appendChild(heading);
    return group;
  }

  function rerenderDemo(): void {
    const demo = shell.querySelector(".guide-demo");
    if (!demo) return;
    demo.replaceWith(createDemo());
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
