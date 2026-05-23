import type { RuntimeMessage } from "../shared/message";

export interface BackgroundTab {
  id?: number;
}

export interface BackgroundInstalledDetails {
  reason: "install" | "update" | string;
}

export interface BackgroundMessageResponse {
  ok: true;
}

export interface BackgroundAppDeps {
  queryAo3Tabs(): Promise<BackgroundTab[]>;
  sendMessageToTab(tabId: number, message: RuntimeMessage): Promise<unknown>;
  addMessageListener(
    callback: (message: unknown, sendResponse?: (response: BackgroundMessageResponse) => void) => void
  ): void;
  addInstalledListener(callback: (details: BackgroundInstalledDetails) => void): void;
  logInfo(message: string): void;
}

interface ChromeLike {
  tabs?: {
    query(queryInfo: { url: string }): Promise<BackgroundTab[]>;
    sendMessage(tabId: number, message: RuntimeMessage): Promise<unknown>;
  };
  runtime?: {
    onMessage?: {
      addListener(
        callback: (
          message: unknown,
          sender: unknown,
          sendResponse: (response: BackgroundMessageResponse) => void
        ) => void
      ): void;
    };
    onInstalled?: {
      addListener(callback: (details: BackgroundInstalledDetails) => void): void;
    };
  };
}

const AO3_TAB_URL_PATTERN = "https://archiveofourown.org/*";

export function initBackgroundApp(deps: BackgroundAppDeps = createRealDeps()): void {
  deps.logInfo("AO3 Tag Highlighter background worker loaded.");

  deps.addMessageListener((message, sendResponse) => {
    if (!isRuntimeMessage(message)) return;

    sendResponse?.({ ok: true });
    void broadcastToAo3Tabs(deps, message).catch(() => {
      // A query-level failure should not keep the sender waiting or crash the worker.
    });
  });

  deps.addInstalledListener((details) => {
    if (details.reason === "install") {
      deps.logInfo("[AO3 Tag Highlighter] Extension installed.");
      return;
    }

    if (details.reason === "update") {
      deps.logInfo("[AO3 Tag Highlighter] Extension updated.");
    }
  });
}

export function isRuntimeMessage(message: unknown): message is RuntimeMessage {
  return (
    isObjectRecord(message) &&
    (message.type === "RULES_UPDATED" || message.type === "SETTINGS_UPDATED")
  );
}

async function broadcastToAo3Tabs(deps: BackgroundAppDeps, message: RuntimeMessage): Promise<void> {
  const tabs = await deps.queryAo3Tabs();

  for (const tab of tabs) {
    if (tab.id == null) continue;

    try {
      await deps.sendMessageToTab(tab.id, message);
    } catch {
      // AO3 tabs may not have a ready content script yet.
    }
  }
}

function createRealDeps(): BackgroundAppDeps {
  return {
    queryAo3Tabs: async () => {
      const tabsApi = getChrome().tabs;
      if (!tabsApi) {
        throw new Error("Chrome tabs API is unavailable");
      }
      return tabsApi.query({ url: AO3_TAB_URL_PATTERN });
    },
    sendMessageToTab: async (tabId, message) => {
      const tabsApi = getChrome().tabs;
      if (!tabsApi) {
        throw new Error("Chrome tabs API is unavailable");
      }
      return tabsApi.sendMessage(tabId, message);
    },
    addMessageListener: (callback) => {
      const onMessage = getChrome().runtime?.onMessage;
      if (!onMessage) {
        throw new Error("Chrome runtime message API is unavailable");
      }

      onMessage.addListener((message, _sender, sendResponse) => {
        callback(message, sendResponse);
      });
    },
    addInstalledListener: (callback) => {
      getChrome().runtime?.onInstalled?.addListener(callback);
    },
    logInfo: (message) => {
      console.info(message);
    },
  };
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
