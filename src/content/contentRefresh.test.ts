import { startContentApp, type ContentAppDeps } from "./contentApp";
import { parseAo3Works } from "./ao3Parser";
import { matchRules } from "../core/ruleEngine";
import { renderMatches, clearRenderedMatches } from "./renderer";
import { startPageObserver, stopPageObserver } from "./pageObserver";
import { calculateHitStats } from "./hitStats";
import { DEFAULT_ACTION_STYLES } from "../core/actionStyles";
import type { Rule, Settings } from "../core/types";

const markup = (id = "work_1", tag = "Angst") => `<li id="${id}" class="work blurb"><h4>Title</h4><ul class="tags"><li class="freeforms"><a class="tag" href="/tags/Angst">${tag}</a></li></ul></li>`;

async function setup() {
  document.body.innerHTML = `<main id="main"><ol>${markup()}</ol></main>`;
  let rules: Rule[] = [{ id: "collapse", pattern: "Angst", action: "hideWork", matchMode: "exact", category: "freeform", enabled: true, createdAt: 1, updatedAt: 1 }];
  let settings: Settings = { extensionEnabled: true, hoverButtonEnabled: false, showToast: false, hideWorkMode: "collapse", enableOnWorkDetailPage: true, languagePreference: "en", actionStyles: DEFAULT_ACTION_STYLES };
  let message: Parameters<ContentAppDeps["addMessageListener"]>[0] = () => {};
  let domChange = () => {};
  const rendered = vi.fn(renderMatches);
  const errors = vi.fn();
  await startContentApp({
    root: document, getSettings: async () => settings, listRules: async () => rules,
    parseAo3Works, matchRules, renderMatches: rendered, clearRenderedMatches,
    mountHoverMenu: vi.fn(), unmountHoverMenu: vi.fn(), calculateHitStats,
    startPageObserver: (callback) => { domChange = callback; startPageObserver(callback); },
    stopPageObserver, debounce: (callback) => callback,
    addMessageListener: (callback) => { message = callback; }, logError: errors,
  });
  return {
    rendered, errors, change: () => domChange(),
    rules: async (next: Rule[]) => { rules = next; message({ type: "RULES_UPDATED" }); await flush(); },
    settings: async (patch: Partial<Settings>) => { settings = { ...settings, ...patch }; message({ type: "SETTINGS_UPDATED" }); await flush(); },
  };
}

async function flush() {
  for (let turn = 0; turn < 12; turn += 1) await Promise.resolve();
}

function expand() {
  document.querySelector<HTMLButtonElement>("[data-ao3th-collapse-placeholder]")!.click();
}

function work() { return document.querySelector<HTMLElement>(".work")!; }

afterEach(() => { stopPageObserver(); document.body.innerHTML = ""; });

describe("content refresh DOM integration", () => {
  it("preserves expansion on real DOM updates without a rendering loop", async () => {
    const app = await setup();
    expand();
    await flush();
    expect(app.rendered).toHaveBeenCalledTimes(1);
    document.querySelector("h4")!.textContent = "Updated title";
    await flush();
    expect(work().dataset.ao3thExpanded).toBe("true");
    expect(document.querySelector(".ao3th-collapse-action")!.textContent).toBe("Collapse again");
    expect(app.rendered).toHaveBeenCalledTimes(2);
    expect(app.errors).not.toHaveBeenCalled();
  });

  it("transfers expansion only to the same stable work identity", async () => {
    await setup();
    expand();
    work().outerHTML = markup();
    await flush();
    expect(work().dataset.ao3thExpanded).toBe("true");
    work().outerHTML = markup("work_2");
    await flush();
    expect(work().dataset.ao3thExpanded).toBeUndefined();
    work().outerHTML = markup();
    await flush();
    expect(work().dataset.ao3thExpanded).toBeUndefined();
  });

  it("clears expansion after a text change removes the collapse match", async () => {
    await setup();
    expand();
    document.querySelector("a")!.firstChild!.textContent = "Fluff";
    await flush();
    expect(work().dataset.ao3thExpanded).toBeUndefined();
    expect(work().dataset.ao3thHidden).toBeUndefined();
    document.querySelector("a")!.textContent = "Angst";
    await flush();
    expect(work().dataset.ao3thHidden).toBe("collapse");
    expect(work().dataset.ao3thExpanded).toBeUndefined();
  });

  it("clears expansion when rules are removed", async () => {
    const app = await setup();
    expand();
    await app.rules([]);
    expect(work().dataset.ao3thExpanded).toBeUndefined();
    expect(document.querySelector("[data-ao3th-collapse-placeholder]")).toBeNull();
  });

  it("resets expansion on disabling and ignores delayed DOM callbacks", async () => {
    const app = await setup();
    expand();
    await app.settings({ extensionEnabled: false });
    app.change();
    expect(work().dataset.ao3thExpanded).toBeUndefined();
    expect(app.rendered).toHaveBeenCalledTimes(1);
    await app.settings({ extensionEnabled: true });
    expect(work().dataset.ao3thExpanded).toBeUndefined();
    expect(work().dataset.ao3thHidden).toBe("collapse");
  });

  it("resets expansion when switching through hide mode", async () => {
    const app = await setup();
    expand();
    await app.settings({ hideWorkMode: "hide" });
    expect(work().hidden).toBe(true);
    expect(work().dataset.ao3thExpanded).toBeUndefined();
    await app.settings({ hideWorkMode: "collapse" });
    expect(work().dataset.ao3thExpanded).toBeUndefined();
  });
});
