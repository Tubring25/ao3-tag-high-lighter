import { matchRules as defaultMatchRules } from "../core/ruleEngine";
import type { MatchResult, ParsedWork, Rule, Settings } from "../core/types";
import { listRules as defaultListRules } from "../storage/ruleStorage";
import { getSettings as defaultGetSettings } from "../storage/settingsStorage";
import type { RuntimeMessage } from "../shared/message";
import { parseAo3Works as defaultParseAo3Works } from "./ao3Parser";
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
  addMessageListener(callback: (message: unknown) => void): void;
  logError(error: unknown): void;
}

interface ChromeLike {
  runtime?: {
    onMessage?: {
      addListener(callback: (message: unknown) => void): void;
    };
  };
}

export async function startContentApp(deps: ContentAppDeps = createRealDeps()): Promise<void> {
  let cachedWorks: ParsedWork[] = [];
  let cachedRules: Rule[] = [];
  let cachedSettings: Settings | null = null;

  deps.addMessageListener((message) => {
    if (!isRuntimeMessage(message)) return;

    if (message.type === "RULES_UPDATED") {
      void handleRulesUpdated().catch(deps.logError);
      return;
    }

    void handleSettingsUpdated().catch(deps.logError);
  });

  cachedSettings = await deps.getSettings();
  if (!cachedSettings.extensionEnabled) return;

  cachedRules = await deps.listRules();
  cachedWorks = deps.parseAo3Works(deps.root);
  runMatchAndRender();

  async function handleRulesUpdated(): Promise<void> {
    cachedRules = await deps.listRules();
    if (!cachedSettings?.extensionEnabled) return;

    ensureWorksParsed();
    runMatchAndRender();
  }

  async function handleSettingsUpdated(): Promise<void> {
    cachedSettings = await deps.getSettings();

    if (!cachedSettings.extensionEnabled) {
      deps.clearRenderedMatches(cachedWorks);
      return;
    }

    cachedRules = await deps.listRules();
    ensureWorksParsed();
    runMatchAndRender();
  }

  function ensureWorksParsed(): void {
    if (cachedWorks.length > 0) return;
    cachedWorks = deps.parseAo3Works(deps.root);
  }

  function runMatchAndRender(): void {
    if (!cachedSettings?.extensionEnabled) {
      deps.clearRenderedMatches(cachedWorks);
      return;
    }

    if (cachedWorks.length === 0) return;

    if (cachedRules.length === 0) {
      deps.clearRenderedMatches(cachedWorks);
      return;
    }

    const result = deps.matchRules(cachedWorks, cachedRules);
    deps.renderMatches(cachedWorks, result, { hideWorkMode: cachedSettings.hideWorkMode });
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
    addMessageListener: (callback) => {
      const onMessage = getChrome().runtime?.onMessage;
      if (!onMessage) {
        throw new Error("Chrome runtime message API is unavailable");
      }
      onMessage.addListener(callback);
    },
    logError: (error) => {
      console.error("[AO3 Tag Highlighter] Content app error:", error);
    },
  };
}

function isRuntimeMessage(message: unknown): message is RuntimeMessage {
  return (
    isObjectRecord(message) &&
    (message.type === "RULES_UPDATED" || message.type === "SETTINGS_UPDATED")
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
