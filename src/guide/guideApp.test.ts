import { renderGuideApp } from "./guideApp";

describe("renderGuideApp", () => {
  it("renders the guide sections with matching modes visible", async () => {
    const container = document.createElement("div");

    await renderGuideApp(container);

    expect(container.textContent).toContain("AO3 Tag Highlighter Guide");
    expect(container.querySelector<HTMLAnchorElement>(".guide-primary-link")?.textContent).toBe(
      "Back to options"
    );
    expect(container.querySelector<HTMLAnchorElement>(".guide-primary-link")?.getAttribute("href")).toBe(
      "options.html"
    );
    expect(container.textContent).toContain("Controls");
    expect(container.textContent).toContain("Live AO3-style preview");
    expect(container.textContent).toContain("Hotshot");
    expect(container.textContent).toContain("SarcastCity");
    expect(container.querySelector(".guide-meta")).toBeNull();
    expect(container.textContent).toContain("Matching modes");
    expect(container.textContent).toContain("What to do next");
    expect(container.querySelectorAll("[data-demo-tag]")).toHaveLength(8);
    expect(container.querySelector(".guide-demo")?.firstElementChild?.className).toBe("guide-preview");
    expect(container.querySelector(".guide-builder [data-demo-match-mode]")).toBeNull();
    expect(container.querySelectorAll(".guide-matching [data-demo-match-mode]")).toHaveLength(3);
    expect(container.querySelector(".guide-match-card")).toBeNull();
  });

  it("updates the live example when action and tag are selected", async () => {
    const container = document.createElement("div");

    await renderGuideApp(container);
    expect(getButton(container, '[data-demo-tag="Firefighter Vi"]').className).toContain("is-highlight");

    getButton(container, '[data-demo-tag="Gun Violence"]').click();
    getButton(container, '[data-demo-action="hideWork"]').click();

    expect(container.querySelector("[data-active-rule-label]")?.textContent).toBe("Collapse: Gun Violence");
    expect(getButton(container, '[data-demo-tag="Gun Violence"]').className).toContain("is-hideWork");
    expect(container.textContent).toContain(
      "This work is collapsed by a collapse rule: Gun Violence"
    );
  });

  it("previews collapse like the listing page: a bar that expands and collapses the work", async () => {
    const container = document.createElement("div");

    await renderGuideApp(container);
    getButton(container, '[data-demo-action="hideWork"]').click();

    const card = () => container.querySelector(".guide-work-card") as HTMLElement;
    const toggle = () => getButton(container, "[data-demo-collapse-toggle]");
    expect(card().className).toContain("is-collapsed");
    expect(toggle().textContent).toBe("This work is collapsed by a collapse rule: Firefighter ViClick to expand");
    expect(card().querySelector("h3")).toBeNull();

    toggle().click();
    expect(card().className).not.toContain("is-collapsed");
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(toggle().textContent).toBe("Collapsed work is expanded for this page.");
    expect(card().textContent).toContain("Hotshot");

    // A new collapse rule starts collapsed again, as on a fresh listing page.
    getButton(container, '[data-demo-tag="Slow Burn"]').click();
    expect(card().className).toContain("is-collapsed");
    expect(toggle().textContent).toContain("Slow Burn");
  });

  it("keeps the preview first, controls below it, and opens the sample work in a new tab", async () => {
    const container = document.createElement("div");

    await renderGuideApp(container);

    const demo = container.querySelector(".guide-demo") as HTMLElement;
    expect([...demo.children].map((child) => child.className)).toEqual(["guide-preview", "guide-builder"]);
    const link = container.querySelector<HTMLAnchorElement>(".guide-work-card h3 a");
    expect(link?.target).toBe("_blank");
    expect(link?.rel).toBe("noopener noreferrer");
  });

  it("keeps match mode examples visible and updates the selected mode in the preview", async () => {
    const container = document.createElement("div");

    await renderGuideApp(container);
    getButton(container, '[data-demo-match-mode="contains"]').click();

    expect(container.querySelector("[data-match-mode-preview]")?.getAttribute("data-match-mode-preview")).toBe(
      "contains"
    );
    expect(container.textContent).not.toContain("Match mode: Contains.");
    expect(container.textContent).toContain("Pattern");
    expect(container.textContent).toContain("Matches tags that include this word or phrase.");
    expect(container.textContent).toContain("Gun Violence");
    expect(container.textContent).not.toContain("Skips");
    expect(container.textContent).toContain("Use for broad themes that appear in many tag names.");
    expect(container.textContent).not.toContain("*Lovers");
  });

  it("uses clear wildcard examples for text before and after the asterisk", async () => {
    const container = document.createElement("div");

    await renderGuideApp(container);
    getButton(container, '[data-demo-match-mode="wildcard"]').click();

    expect(container.querySelector("[data-match-mode-preview]")?.getAttribute("data-match-mode-preview")).toBe(
      "wildcard"
    );
    expect(container.textContent).toContain("Text before *");
    expect(container.textContent).toContain("Enemies*");
    expect(container.textContent).toContain("Text after *");
    expect(container.textContent).toContain("*Lovers");
    expect(container.textContent).toContain("Enemies to Lovers");
    expect(container.textContent).toContain("Simps to Enemies to Lovers");
    expect(container.textContent).toContain("Former Enemies to Lovers");
    expect(container.textContent).toContain("Enemies to Lovers-ish");
    expect(container.textContent).toContain("Lovers to Enemies");
  });

  it("keeps the demo focused on preview controls without an extra add-example action", async () => {
    const container = document.createElement("div");

    await renderGuideApp(container);
    expect(container.textContent).not.toContain("Example rule added");
    expect(container.querySelector("[data-create-demo-rule]")).toBeNull();

    getButton(container, '[data-demo-tag="Slow Burn"]').click();
    getButton(container, '[data-demo-action="warn"]').click();
    getButton(container, '[data-demo-match-mode="contains"]').click();

    expect(container.querySelector("[data-active-rule-label]")?.textContent).toBe("Warn: Slow Burn");
    expect(container.textContent).not.toContain("Match mode: Contains.");
  });
});

function getButton(container: HTMLElement, selector: string): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>(selector);
  if (!button) throw new Error(`Missing button: ${selector}`);
  return button;
}
