import { matchRules as defaultMatchRules } from "../core/ruleEngine";
import type { MatchResult, ParsedWork, Rule, Settings } from "../core/types";
import { listRules as defaultListRules } from "../storage/ruleStorage";
import { getSettings as defaultGetSettings } from "../storage/settingsStorage";
import type { HitStats, RuntimeMessage } from "../shared/message";
import { LOG_PREFIX } from "../shared/constants";
import { debounce as defaultDebounce } from "../shared/utils";
import { parseAo3Works as defaultParseAo3Works } from "./ao3Parser";
import { calculateHitStats as defaultCalculateHitStats } from "./hitStats";
import {
  startPageObserver as defaultStartPageObserver,
  stopPageObserver as defaultStopPageObserver,
} from "./pageObserver";
import {
  mountHoverMenu as defaultMountHoverMenu,
  unmountHoverMenu as defaultUnmountHoverMenu,
  type HoverMenuOptions,
} from "./hoverMenu";
import {
  clearRenderedMatches as defaultClearRenderedMatches,
  renderMatches as defaultRenderMatches,
  type RenderOptions,
} from "./renderer";

export interface ContentAppDeps {
  root: ParentNode;
  getSettings(): Promise<Settings>;
  listRules(): Promise<Rule[]>;
  parseAo3Works(root: ParentNode): ParsedWork[];
  matchRules(works: readonly ParsedWork[], rules: readonly Rule[]): MatchResult;
  renderMatches(
    works: readonly ParsedWork[],
    matchResult: MatchResult,
    options: RenderOptions
  ): void;
  clearRenderedMatches(works: readonly ParsedWork[]): void;
  mountHoverMenu(
    works: readonly ParsedWork[],
    settings: Settings,
    options: Pick<HoverMenuOptions, "onRuleCreated">
  ): void;
  unmountHoverMenu(): void;
  calculateHitStats(
    matchResult: MatchResult | null,
    totalRules: number,
    works: readonly ParsedWork[]
  ): HitStats;
  startPageObserver(onDomChange: () => void): void;
  stopPageObserver(): void;
  debounce<T extends (...args: Parameters<T>) => void>(
    fn: T,
    delayMs: number
  ): (...args: Parameters<T>) => void;
  addMessageListener(callback: (message: unknown, sendResponse?: (response: unknown) => void) => void): void;
  logError(error: unknown): void;
}

interface ChromeLike {
  runtime?: {
    onMessage?: {
      addListener(
        callback: (message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => void
      ): void;
    };
  };
}

export async function startContentApp(deps: ContentAppDeps = createRealDeps()): Promise<void> {
  let cachedWorks: ParsedWork[] = [];
  let cachedRules: Rule[] = [];
  let cachedSettings: Settings | null = null;
  let latestMatchResult: MatchResult | null = null;
  const debouncedHandleDomChanged = deps.debounce(() => {
    try {
      handleDomChanged();
    } catch (error) {
      deps.logError(error);
    }
  }, 300);

  try {
    deps.addMessageListener((message, sendResponse) => {
      if (!isRuntimeMessage(message)) return;

      try {
        if (message.type === "GET_HIT_STATS") {
          sendResponse?.(getHitStats());
          return;
        }

        if (message.type === "RULES_UPDATED") {
          void handleRulesUpdated().catch(deps.logError);
          return;
        }

        void handleSettingsUpdated().catch(deps.logError);
      } catch (error) {
        deps.logError(error);
        if (message.type === "GET_HIT_STATS") {
          sendResponse?.(createEmptyHitStats(cachedRules.length));
        }
      }
    });

    cachedSettings = await deps.getSettings();
    if (!cachedSettings.extensionEnabled) return;

    cachedRules = await deps.listRules();
    refreshWorks();
    runMatchAndRender();
    syncHoverMenu();
    startObserver();
  } catch (error) {
    deps.logError(error);
  }

  async function handleRulesUpdated(): Promise<void> {
    cachedRules = await deps.listRules();
    if (!cachedSettings?.extensionEnabled) return;

    refreshWorks();
    runMatchAndRender();
    syncHoverMenu();
  }

  async function handleSettingsUpdated(): Promise<void> {
    cachedSettings = await deps.getSettings();

    if (!cachedSettings.extensionEnabled) {
      safeStopPageObserver();
      safeClearRenderedMatches();
      safeUnmountHoverMenu();
      return;
    }

    cachedRules = await deps.listRules();
    refreshWorks();
    runMatchAndRender();
    syncHoverMenu();
    startObserver();
  }

  function refreshWorks(): void {
    try {
      cachedWorks = deps.parseAo3Works(deps.root);
    } catch (error) {
      cachedWorks = [];
      latestMatchResult = null;
      deps.logError(error);
    }
  }

  function handleDomChanged(): void {
    safeClearRenderedMatches();
    refreshWorks();
    runMatchAndRender();
    syncHoverMenu();
  }

  function startObserver(): void {
    try {
      deps.startPageObserver(debouncedHandleDomChanged);
    } catch (error) {
      deps.logError(error);
    }
  }

  function runMatchAndRender(): void {
    if (!cachedSettings?.extensionEnabled) {
      safeClearRenderedMatches();
      latestMatchResult = null;
      return;
    }

    if (cachedWorks.length === 0) {
      latestMatchResult = null;
      return;
    }

    if (cachedRules.length === 0) {
      safeClearRenderedMatches();
      latestMatchResult = null;
      return;
    }

    try {
      const result = deps.matchRules(cachedWorks, cachedRules);
      latestMatchResult = result;
      deps.renderMatches(cachedWorks, result, {
        hideWorkMode: cachedSettings.hideWorkMode,
        actionStyles: cachedSettings.actionStyles,
      });
    } catch (error) {
      latestMatchResult = null;
      deps.logError(error);
    }
  }

  function syncHoverMenu(): void {
    try {
      if (!cachedSettings?.extensionEnabled || !cachedSettings.hoverButtonEnabled || cachedWorks.length === 0) {
        safeUnmountHoverMenu();
        return;
      }

      deps.mountHoverMenu(cachedWorks, cachedSettings, {
        onRuleCreated: handleQuickAddRuleCreated,
      });
    } catch (error) {
      deps.logError(error);
    }
  }

  async function handleQuickAddRuleCreated(): Promise<void> {
    try {
      cachedRules = await deps.listRules();
      runMatchAndRender();
    } catch (error) {
      deps.logError(error);
    }
  }

  function getHitStats(): HitStats {
    try {
      return deps.calculateHitStats(latestMatchResult, cachedRules.length, cachedWorks);
    } catch (error) {
      deps.logError(error);
      return createEmptyHitStats(cachedRules.length);
    }
  }

  function safeClearRenderedMatches(): void {
    try {
      deps.clearRenderedMatches(cachedWorks);
    } catch (error) {
      deps.logError(error);
    }
  }

  function safeStopPageObserver(): void {
    try {
      deps.stopPageObserver();
    } catch (error) {
      deps.logError(error);
    }
  }

  function safeUnmountHoverMenu(): void {
    try {
      deps.unmountHoverMenu();
    } catch (error) {
      deps.logError(error);
    }
  }
}

function createRealDeps(): ContentAppDeps {
  return {
    root: document,
    getSettings: defaultGetSettings,
    listRules: defaultListRules,
    parseAo3Works: defaultParseAo3Works,
    matchRules: defaultMatchRules,
    renderMatches: defaultRenderMatches,
    clearRenderedMatches: defaultClearRenderedMatches,
    mountHoverMenu: defaultMountHoverMenu,
    unmountHoverMenu: defaultUnmountHoverMenu,
    calculateHitStats: defaultCalculateHitStats,
    startPageObserver: defaultStartPageObserver,
    stopPageObserver: defaultStopPageObserver,
    debounce: defaultDebounce,
    addMessageListener: (callback) => {
      const onMessage = getChrome().runtime?.onMessage;
      if (!onMessage) {
        throw new Error("Chrome runtime message API is unavailable");
      }
      onMessage.addListener((message, _sender, sendResponse) => {
        callback(message, sendResponse);
      });
    },
    logError: (error) => {
      console.error(`${LOG_PREFIX} Content app error:`, error);
    },
  };
}

function createEmptyHitStats(totalRules: number): HitStats {
  return {
    highlight: 0,
    warn: 0,
    hideWork: 0,
    totalRules,
  };
}

function isRuntimeMessage(message: unknown): message is RuntimeMessage {
  return (
    isObjectRecord(message) &&
    (message.type === "RULES_UPDATED" ||
      message.type === "SETTINGS_UPDATED" ||
      message.type === "GET_HIT_STATS")
  );
}

function getChrome(): ChromeLike {
  const chromeApi = (globalThis as typeof globalThis & { chrome?: ChromeLike }).chrome;
  if (!chromeApi) {
    throw new Error("Chrome extension API is unavailable");
  }
  return chromeApi;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
