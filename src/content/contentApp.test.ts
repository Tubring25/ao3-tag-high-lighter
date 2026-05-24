import type { MatchResult, ParsedTag, ParsedWork, Rule, Settings } from "../core/types";
import { startContentApp, type ContentAppDeps } from "./contentApp";

describe("startContentApp", () => {
  it("registers the message listener but does not read rules or render when disabled", async () => {
    const { deps, addMessageListener, listRules, parseAo3Works, renderMatches } = createDeps({
      getSettings: vi.fn(async () => createSettings({ extensionEnabled: false })),
    });

    await startContentApp(deps);

    expect(addMessageListener).toHaveBeenCalledTimes(1);
    expect(listRules).not.toHaveBeenCalled();
    expect(parseAo3Works).not.toHaveBeenCalled();
    expect(renderMatches).not.toHaveBeenCalled();
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
    expect(renderMatches).toHaveBeenCalledWith([work], matchResult, { hideWorkMode: "hide" });
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
    });
  });

  it("refreshes rules and renders again when RULES_UPDATED arrives", async () => {
    const work = createWork();
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

    await startContentApp(deps);
    listenerRef.listener?.({ type: "RULES_UPDATED" });
    await flushAsyncHandlers();

    expect(listRules).toHaveBeenCalledTimes(2);
    expect(renderMatches).toHaveBeenLastCalledWith([work], secondResult, { hideWorkMode: "collapse" });
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
    const { deps, clearRenderedMatches, getSettings } = createDeps({
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
  });

  it("re-parses and renders when SETTINGS_UPDATED re-enables after disabled startup", async () => {
    const work = createWork();
    const rule = createRule();
    const listenerRef = createListenerRef();
    const { deps, getSettings, listRules, parseAo3Works, renderMatches } = createDeps({
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
  };
}

function createListenerRef() {
  let listener: ((message: unknown) => void) | null = null;
  const addMessageListener = vi.fn((callback: (message: unknown) => void) => {
    listener = callback;
  });

  return {
    get listener() {
      return listener;
    },
    addMessageListener,
  };
}

function createSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    extensionEnabled: true,
    hoverButtonEnabled: true,
    showToast: true,
    hideWorkMode: "collapse",
    enableOnWorkDetailPage: true,
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

function createWork(): ParsedWork {
  const element = document.createElement("article");
  const tagElement = document.createElement("a");
  return {
    id: "work-1",
    element,
    tags: [createTag(tagElement)],
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
