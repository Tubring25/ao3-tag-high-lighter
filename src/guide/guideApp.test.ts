import { renderGuideApp } from "./guideApp";

describe("renderGuideApp", () => {
  it("renders the interactive guide sections", () => {
    const container = document.createElement("div");

    renderGuideApp(container);

    expect(container.textContent).toContain("AO3 Tag Highlighter Guide");
    expect(container.textContent).toContain("Build a sample rule");
    expect(container.textContent).toContain("Use it on AO3");
    expect(container.querySelectorAll("[data-demo-tag]")).toHaveLength(5);
  });

  it("updates the live example when action and tag are selected", () => {
    const container = document.createElement("div");

    renderGuideApp(container);
    getButton(container, '[data-demo-tag="Major Character Death"]').click();
    getButton(container, '[data-demo-action="hideWork"]').click();

    expect(container.querySelector("[data-active-rule-label]")?.textContent).toBe(
      "Collapse: Major Character Death"
    );
    expect(container.textContent).toContain(
      "This work is collapsed by a hideWork rule: Major Character Death."
    );
  });

  it("adds a selected example rule to the rule list", () => {
    const container = document.createElement("div");

    renderGuideApp(container);
    getButton(container, '[data-demo-tag="Hurt/Comfort"]').click();
    getButton(container, '[data-demo-action="warn"]').click();
    getButton(container, '[data-demo-match-mode="contains"]').click();
    getButton(container, "[data-create-demo-rule]").click();

    expect(container.textContent).toContain("Warn");
    expect(container.textContent).toContain("Hurt/Comfort · contains · freeform");
  });
});

function getButton(container: HTMLElement, selector: string): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>(selector);
  if (!button) throw new Error(`Missing button: ${selector}`);
  return button;
}
