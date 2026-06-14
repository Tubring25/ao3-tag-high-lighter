import type { MatchResult, ParsedTag, ParsedWork, Rule, Settings } from "../core/types";
import { calculateHitStats } from "./hitStats";
import { startContentApp, type ContentAppDeps } from "./contentApp";
import { DEFAULT_ACTION_STYLES } from "../core/actionStyles";

describe("startContentApp", () => {
  it("registers the message listener but does not read rules or render when disabled", async () => {
    const { deps, addMessageListener, listRules, parseAo3Works, renderMatches, startPageObserver } = createDeps({
      getSettings: vi.fn(async () => createSettings({ extensionEnabled: false })),
    });

    await startContentApp(deps);

    expect(addMessageListener).toHaveBeenCalledTimes(1);
    expect(listRules).not.toHaveBeenCalled();
    expect(parseAo3Works).not.toHaveBeenCalled();
    expect(renderMatches).not.toHaveBeenCalled();
    expect(startPageObserver).not.toHaveBeenCalled();
  });

  it("parses but does not render when enabled with no rules", async () => {
    const work = createWork();
    const { deps, addMessageListener, parseAo3Works, matchRules, renderMatches, clearRenderedMatches } =
      createDeps({
        listRules: vi.fn(async () => []),
        parseAo3Works: vi.fn(() => [work]),
      });

    await startContentApp(deps);

    expect(addMessageListener).toHaveBeenCalledTimes(1);
    expect(parseAo3Works).toHaveBeenCalledWith(document);
    expect(matchRules).not.toHaveBeenCalled();
    expect(renderMatches).not.toHaveBeenCalled();
    expect(clearRenderedMatches).toHaveBeenCalledWith([work]);
  });

  it("parses, matches, and renders enabled pages with rules", async () => {
    const work = createWork();
    const rule = createRule();
    const matchResult = createMatchResult();
    const { deps, matchRules, renderMatches } = createDeps({
      getSettings: vi.fn(async () => createSettings({ hideWorkMode: "hide" })),
      listRules: vi.fn(async () => [rule]),
      parseAo3Works: vi.fn(() => [work]),
      matchRules: vi.fn(() => matchResult),
    });

    await startContentApp(deps);

    expect(matchRules).toHaveBeenCalledWith([work], [rule]);
    expect(renderMatches).toHaveBeenCalledWith([work], matchResult, {
      hideWorkMode: "hide",
      actionStyles: DEFAULT_ACTION_STYLES,
    });
  });

  it("starts the page observer after enabled initialization", async () => {
    const { deps, startPageObserver } = createDeps();

    await startContentApp(deps);

    expect(startPageObserver).toHaveBeenCalledWith(expect.any(Function));
  });

  it("mounts the hover menu when hover is enabled", async () => {
    const work = createWork();
    const { deps, mountHoverMenu } = createDeps({
      parseAo3Works: vi.fn(() => [work]),
    });

    await startContentApp(deps);

    expect(mountHoverMenu).toHaveBeenCalledWith(
      [work],
      createSettings(),
      expect.objectContaining({ onRuleCreated: expect.any(Function) })
    );
  });

  it("does not mount the hover menu when hover is disabled", async () => {
    const { deps, mountHoverMenu, unmountHoverMenu } = createDeps({
      getSettings: vi.fn(async () => createSettings({ hoverButtonEnabled: false })),
    });

    await startContentApp(deps);

    expect(mountHoverMenu).not.toHaveBeenCalled();
    expect(unmountHoverMenu).toHaveBeenCalledTimes(1);
  });

  it("unmounts hover menu when SETTINGS_UPDATED disables hover", async () => {
    const listenerRef = createListenerRef();
    const { deps, getSettings, unmountHoverMenu } = createDeps({
      addMessageListener: listenerRef.addMessageListener,
    });
    getSettings
      .mockResolvedValueOnce(createSettings({ hoverButtonEnabled: true }))
      .mockResolvedValueOnce(createSettings({ hoverButtonEnabled: false }));

    await startContentApp(deps);
    listenerRef.listener?.({ type: "SETTINGS_UPDATED" });
    await flushAsyncHandlers();

    expect(unmountHoverMenu).toHaveBeenCalled();
  });

  it("refreshes rules and rerenders after a quick-add rule is created", async () => {
    const work = createWork();
    const firstRule = createRule({ id: "rule-1" });
    const addedRule = createRule({ id: "rule-2", pattern: "Angst" });
    const addedResult = createMatchResult({
      tagMatches: [{ tagId: "tag-1", ruleId: "rule-2", action: "highlight" }],
    });
    const { deps, listRules, mountHoverMenu, renderMatches, matchRules } = createDeps({
      listRules: vi.fn(async () => [firstRule]),
      parseAo3Works: vi.fn(() => [work]),
      matchRules: vi.fn(() => createMatchResult()),
    });
    listRules.mockResolvedValueOnce([firstRule]).mockResolvedValueOnce([firstRule, addedRule]);
    matchRules.mockReturnValueOnce(createMatchResult()).mockReturnValueOnce(addedResult);

    await startContentApp(deps);
    const options = mountHoverMenu.mock.calls[0][2];
    await options.onRuleCreated();

    expect(listRules).toHaveBeenCalledTimes(2);
    expect(renderMatches).toHaveBeenLastCalledWith([work], addedResult, {
      hideWorkMode: "collapse",
      actionStyles: DEFAULT_ACTION_STYLES,
    });
  });

  it("responds to GET_HIT_STATS with the latest match stats", async () => {
    const work = createWork();
    const rule = createRule();
    const listenerRef = createListenerRef();
    const sendResponse = vi.fn();
    const { deps } = createDeps({
      listRules: vi.fn(async () => [rule]),
      parseAo3Works: vi.fn(() => [work]),
      matchRules: vi.fn(() =>
        createMatchResult({
          tagMatches: [{ tagId: "tag-1", ruleId: "rule-1", action: "highlight" }],
          workSummaries: [
            {
              workId: "work-1",
              matchedRuleIds: ["rule-1"],
              hasWarn: true,
              hasHideWork: false,
            },
          ],
        })
      ),
      addMessageListener: listenerRef.addMessageListener,
    });

    await startContentApp(deps);
    listenerRef.listener?.({ type: "GET_HIT_STATS" }, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({
      highlight: 1,
      warn: 1,
      hideWork: 0,
      totalRules: 1,
    });
  });

  it("responds to GET_HIT_STATS with zero hits when disabled", async () => {
    const listenerRef = createListenerRef();
    const sendResponse = vi.fn();
    const { deps } = createDeps({
      getSettings: vi.fn(async () => createSettings({ extensionEnabled: false })),
      addMessageListener: listenerRef.addMessageListener,
    });

    await startContentApp(deps);
    listenerRef.listener?.({ type: "GET_HIT_STATS" }, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({
      highlight: 0,
      warn: 0,
      hideWork: 0,
      totalRules: 0,
    });
  });

  it("uses the updated match result for GET_HIT_STATS after RULES_UPDATED", async () => {
    const work = createWork();
    const firstRule = createRule({ id: "rule-1" });
    const secondRule = createRule({ id: "rule-2" });
    const listenerRef = createListenerRef();
    const sendResponse = vi.fn();
    const matchRules = vi.fn(() => createMatchResult());
    matchRules
      .mockReturnValueOnce(createMatchResult())
      .mockReturnValueOnce(
        createMatchResult({
          tagMatches: [{ tagId: "tag-1", ruleId: "rule-2", action: "highlight" }],
        })
      );
    const { deps, listRules } = createDeps({
      listRules: vi.fn(async () => [firstRule]),
      parseAo3Works: vi.fn(() => [work]),
      matchRules,
      addMessageListener: listenerRef.addMessageListener,
    });
    listRules.mockResolvedValueOnce([firstRule]).mockResolvedValueOnce([firstRule, secondRule]);

    await startContentApp(deps);
    listenerRef.listener?.({ type: "RULES_UPDATED" });
    await flushAsyncHandlers();
    listenerRef.listener?.({ type: "GET_HIT_STATS" }, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({
      highlight: 1,
      warn: 0,
      hideWork: 0,
      totalRules: 2,
    });
  });

  it("refreshes rules and renders again when RULES_UPDATED arrives", async () => {
    const work = createWork();
    const reparsedWork = createWork({ id: "work-2" });
    const firstRule = createRule({ id: "rule-1", pattern: "Slow Burn" });
    const secondRule = createRule({ id: "rule-2", pattern: "Angst" });
    const firstResult = createMatchResult({ tagMatches: [{ tagId: "tag-1", ruleId: "rule-1", action: "highlight" }] });
    const secondResult = createMatchResult({ tagMatches: [{ tagId: "tag-1", ruleId: "rule-2", action: "warn" }] });
    const listenerRef = createListenerRef();
    const matchRules = vi.fn(() => firstResult);
    matchRules.mockReturnValueOnce(firstResult).mockReturnValueOnce(secondResult);
    const { deps, listRules, renderMatches } = createDeps({
      listRules: vi.fn(async () => [firstRule]),
      parseAo3Works: vi.fn(() => [work]),
      matchRules,
      addMessageListener: listenerRef.addMessageListener,
    });
    listRules.mockResolvedValueOnce([firstRule]).mockResolvedValueOnce([secondRule]);
    deps.parseAo3Works = vi.fn().mockReturnValueOnce([work]).mockReturnValueOnce([reparsedWork]);

    await startContentApp(deps);
    listenerRef.listener?.({ type: "RULES_UPDATED" });
    await flushAsyncHandlers();

    expect(listRules).toHaveBeenCalledTimes(2);
    expect(deps.parseAo3Works).toHaveBeenCalledTimes(2);
    expect(renderMatches).toHaveBeenLastCalledWith([reparsedWork], secondResult, {
      hideWorkMode: "collapse",
      actionStyles: DEFAULT_ACTION_STYLES,
    });
  });

  it("clears old rendering when RULES_UPDATED leaves no rules", async () => {
    const work = createWork();
    const rule = createRule();
    const listenerRef = createListenerRef();
    const { deps, clearRenderedMatches, listRules } = createDeps({
      listRules: vi.fn(async () => [rule]),
      parseAo3Works: vi.fn(() => [work]),
      addMessageListener: listenerRef.addMessageListener,
    });
    listRules.mockResolvedValueOnce([rule]).mockResolvedValueOnce([]);

    await startContentApp(deps);
    listenerRef.listener?.({ type: "RULES_UPDATED" });
    await flushAsyncHandlers();

    expect(clearRenderedMatches).toHaveBeenCalledWith([work]);
  });

  it("clears rendering when SETTINGS_UPDATED disables the extension", async () => {
    const work = createWork();
    const listenerRef = createListenerRef();
    const { deps, clearRenderedMatches, getSettings, stopPageObserver } = createDeps({
      parseAo3Works: vi.fn(() => [work]),
      addMessageListener: listenerRef.addMessageListener,
    });
    getSettings
      .mockResolvedValueOnce(createSettings({ extensionEnabled: true }))
      .mockResolvedValueOnce(createSettings({ extensionEnabled: false }));

    await startContentApp(deps);
    listenerRef.listener?.({ type: "SETTINGS_UPDATED" });
    await flushAsyncHandlers();

    expect(clearRenderedMatches).toHaveBeenCalledWith([work]);
    expect(stopPageObserver).toHaveBeenCalledTimes(1);
  });

  it("re-parses and renders when SETTINGS_UPDATED re-enables after disabled startup", async () => {
    const work = createWork();
    const rule = createRule();
    const listenerRef = createListenerRef();
    const { deps, getSettings, listRules, parseAo3Works, renderMatches, startPageObserver } = createDeps({
      getSettings: vi.fn(async () => createSettings({ extensionEnabled: false })),
      listRules: vi.fn(async () => [rule]),
      parseAo3Works: vi.fn(() => [work]),
      addMessageListener: listenerRef.addMessageListener,
    });
    getSettings
      .mockResolvedValueOnce(createSettings({ extensionEnabled: false }))
      .mockResolvedValueOnce(createSettings({ extensionEnabled: true }));

    await startContentApp(deps);
    listenerRef.listener?.({ type: "SETTINGS_UPDATED" });
    await flushAsyncHandlers();

    expect(listRules).toHaveBeenCalledTimes(1);
    expect(parseAo3Works).toHaveBeenCalledWith(document);
    expect(renderMatches).toHaveBeenCalledTimes(1);
    expect(startPageObserver).toHaveBeenCalledTimes(1);
  });

  it("debounces DOM change handling and rerenders with reparsed works", async () => {
    const oldWork = createWork({ id: "old-work" });
    const newWork = createWork({ id: "new-work" });
    const listenerRef = createObserverRef();
    const { deps, parseAo3Works, clearRenderedMatches, renderMatches, debounce } = createDeps({
      parseAo3Works: vi.fn().mockReturnValueOnce([oldWork]).mockReturnValueOnce([newWork]),
      startPageObserver: listenerRef.startPageObserver,
      debounce: vi.fn((fn: () => void) => fn),
    });

    await startContentApp(deps);
    listenerRef.listener?.();

    expect(debounce).toHaveBeenCalledWith(expect.any(Function), 300);
    expect(clearRenderedMatches).toHaveBeenCalledWith([oldWork]);
    expect(parseAo3Works).toHaveBeenCalledTimes(2);
    expect(renderMatches).toHaveBeenLastCalledWith([newWork], expect.any(Object), {
      hideWorkMode: "collapse",
      actionStyles: DEFAULT_ACTION_STYLES,
    });
  });

  it("logs observer callback errors instead of throwing", async () => {
    const listenerRef = createObserverRef();
    const { deps, parseAo3Works, logError } = createDeps({
      parseAo3Works: vi.fn(() => [createWork()]),
      startPageObserver: listenerRef.startPageObserver,
      debounce: vi.fn((fn: () => void) => fn),
    });
    parseAo3Works.mockReturnValueOnce([createWork()]).mockImplementationOnce(() => {
      throw new Error("Parse failed");
    });

    await startContentApp(deps);
    expect(() => listenerRef.listener?.()).not.toThrow();
    expect(logError).toHaveBeenCalledWith(expect.any(Error));
  });

  it("logs parser errors during initialization instead of throwing", async () => {
    const parseError = new Error("Parse failed");
    const { deps, logError, renderMatches } = createDeps({
      parseAo3Works: vi.fn(() => {
        throw parseError;
      }),
    });

    await expect(startContentApp(deps)).resolves.toBeUndefined();

    expect(logError).toHaveBeenCalledWith(parseError);
    expect(renderMatches).not.toHaveBeenCalled();
  });

  it("logs matcher errors instead of throwing", async () => {
    const matchError = new Error("Match failed");
    const { deps, logError, renderMatches } = createDeps({
      matchRules: vi.fn(() => {
        throw matchError;
      }),
    });

    await expect(startContentApp(deps)).resolves.toBeUndefined();

    expect(logError).toHaveBeenCalledWith(matchError);
    expect(renderMatches).not.toHaveBeenCalled();
  });

  it("logs renderer errors instead of throwing", async () => {
    const renderError = new Error("Render failed");
    const { deps, logError } = createDeps({
      renderMatches: vi.fn(() => {
        throw renderError;
      }),
    });

    await expect(startContentApp(deps)).resolves.toBeUndefined();

    expect(logError).toHaveBeenCalledWith(renderError);
  });

  it("returns safe hit stats when stats calculation fails", async () => {
    const listenerRef = createListenerRef();
    const sendResponse = vi.fn();
    const statsError = new Error("Stats failed");
    const { deps, logError } = createDeps({
      addMessageListener: listenerRef.addMessageListener,
      calculateHitStats: vi.fn(() => {
        throw statsError;
      }),
    });

    await startContentApp(deps);
    expect(() => listenerRef.listener?.({ type: "GET_HIT_STATS" }, sendResponse)).not.toThrow();

    expect(logError).toHaveBeenCalledWith(statsError);
    expect(sendResponse).toHaveBeenCalledWith({
      highlight: 0,
      warn: 0,
      hideWork: 0,
      totalRules: 1,
    });
  });

  it("skips rendering when parser returns no works", async () => {
    const { deps, matchRules, renderMatches, clearRenderedMatches } = createDeps({
      parseAo3Works: vi.fn(() => []),
    });

    await startContentApp(deps);

    expect(matchRules).not.toHaveBeenCalled();
    expect(renderMatches).not.toHaveBeenCalled();
    expect(clearRenderedMatches).not.toHaveBeenCalled();
  });
});

function createDeps(overrides: Partial<ContentAppDeps> = {}) {
  const getSettings = vi.fn(async () => createSettings());
  const listRules = vi.fn(async () => [createRule()]);
  const parseAo3Works = vi.fn(() => [createWork()]);
  const matchRules = vi.fn(() => createMatchResult());
  const renderMatches = vi.fn();
  const clearRenderedMatches = vi.fn();
  const addMessageListener = vi.fn();
  const logError = vi.fn();
  const mountHoverMenu = vi.fn();
  const unmountHoverMenu = vi.fn();
  const calculateStats = vi.fn(calculateHitStats);
  const startPageObserver = vi.fn();
  const stopPageObserver = vi.fn();
  const debounce = vi.fn(<T extends (...args: unknown[]) => void>(fn: T) => fn);

  const deps: ContentAppDeps = {
    root: document,
    getSettings,
    listRules,
    parseAo3Works,
    matchRules,
    renderMatches,
    clearRenderedMatches,
    addMessageListener,
    logError,
    mountHoverMenu,
    unmountHoverMenu,
    calculateHitStats: calculateStats,
    startPageObserver,
    stopPageObserver,
    debounce,
    ...overrides,
  };

  return {
    deps,
    getSettings: deps.getSettings as typeof getSettings,
    listRules: deps.listRules as typeof listRules,
    parseAo3Works: deps.parseAo3Works as typeof parseAo3Works,
    matchRules: deps.matchRules as typeof matchRules,
    renderMatches: deps.renderMatches as typeof renderMatches,
    clearRenderedMatches: deps.clearRenderedMatches as typeof clearRenderedMatches,
    addMessageListener: deps.addMessageListener as typeof addMessageListener,
    logError: deps.logError as typeof logError,
    mountHoverMenu: deps.mountHoverMenu as typeof mountHoverMenu,
    unmountHoverMenu: deps.unmountHoverMenu as typeof unmountHoverMenu,
    startPageObserver: deps.startPageObserver as typeof startPageObserver,
    stopPageObserver: deps.stopPageObserver as typeof stopPageObserver,
    debounce: deps.debounce as typeof debounce,
  };
}

function createListenerRef() {
  let listener: ((message: unknown, sendResponse?: (response: unknown) => void) => void) | null =
    null;
  const addMessageListener = vi.fn(
    (callback: (message: unknown, sendResponse?: (response: unknown) => void) => void) => {
    listener = callback;
    }
  );

  return {
    get listener() {
      return listener;
    },
    addMessageListener,
  };
}

function createObserverRef() {
  let listener: (() => void) | null = null;
  const startPageObserver = vi.fn((callback: () => void) => {
    listener = callback;
  });

  return {
    get listener() {
      return listener;
    },
    startPageObserver,
  };
}

function createSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    extensionEnabled: true,
    hoverButtonEnabled: true,
    showToast: true,
    hideWorkMode: "collapse",
    enableOnWorkDetailPage: true,
    languagePreference: "auto",
    actionStyles: DEFAULT_ACTION_STYLES,
    ...overrides,
  };
}

function createRule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: "rule-1",
    pattern: "Slow Burn",
    action: "highlight",
    matchMode: "exact",
    category: "freeform",
    enabled: true,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function createWork(overrides: Partial<ParsedWork> = {}): ParsedWork {
  const element = document.createElement("article");
  const tagElement = document.createElement("a");
  return {
    id: "work-1",
    element,
    tags: [createTag(tagElement)],
    ...overrides,
  };
}

function createTag(element: HTMLElement): ParsedTag {
  return {
    id: "tag-1",
    text: "Slow Burn",
    normalizedText: "slow burn",
    category: "freeform",
    element,
    workId: "work-1",
  };
}

function createMatchResult(overrides: Partial<MatchResult> = {}): MatchResult {
  return {
    tagMatches: [],
    workSummaries: [],
    ...overrides,
  };
}

async function flushAsyncHandlers(): Promise<void> {
  for (let i = 0; i < 6; i += 1) {
    await Promise.resolve();
  }
}
