import type { RuntimeMessage } from "../shared/message";
import type { StorageMutationResponse } from "../storage/mutationClient";
import { createStorageMutationQueue, isStorageMutation } from "./storageMutations";
import { syncCustomHostScripts, toExtensionRelativePath, type CustomHostContentScript } from "./customHostScripts";
import { AO3_ORIGIN_PATTERN, LOG_PREFIX } from "../shared/constants";
import { getCustomOriginPatterns } from "../shared/customHosts";
import { getExtensionApi } from "../shared/extensionApi";

export interface BackgroundTab {
  id?: number;
}

export interface BackgroundInstalledDetails {
  reason: "install" | "update" | string;
}

export type BackgroundMessageResponse = StorageMutationResponse;

export interface BackgroundAppDeps {
  queryAo3Tabs(): Promise<BackgroundTab[]>;
  sendMessageToTab(tabId: number, message: RuntimeMessage): Promise<unknown>;
  addMessageListener(
    callback: (message: unknown, sendResponse?: (response: BackgroundMessageResponse) => void) => boolean | void
  ): void;
  addInstalledListener(callback: (details: BackgroundInstalledDetails) => void): void;
  addPermissionsChangedListener(callback: () => void): void;
  syncCustomHostScripts(): Promise<void>;
  logInfo(message: string): void;
  logError(error: unknown): void;
}

interface ChromeLike {
  tabs?: {
    query(queryInfo: { url: string[] }): Promise<BackgroundTab[]>;
    sendMessage(tabId: number, message: RuntimeMessage): Promise<unknown>;
  };
  runtime?: {
    onMessage?: {
      addListener(
        callback: (
          message: unknown,
          sender: unknown,
          sendResponse: (response: BackgroundMessageResponse) => void
        ) => boolean | void
      ): void;
    };
    onInstalled?: {
      addListener(callback: (details: BackgroundInstalledDetails) => void): void;
    };
    getManifest?(): { content_scripts?: Array<{ matches?: string[]; js?: string[]; css?: string[] }> };
    getURL?(path: string): string;
  };
  permissions?: {
    getAll(): Promise<{ origins?: string[] }>;
    onAdded?: { addListener(callback: () => void): void };
    onRemoved?: { addListener(callback: () => void): void };
  };
  scripting?: {
    getRegisteredContentScripts(filter: { ids: string[] }): Promise<CustomHostContentScript[]>;
    registerContentScripts(scripts: CustomHostContentScript[]): Promise<void>;
    unregisterContentScripts(filter: { ids: string[] }): Promise<void>;
  };
}

export function initBackgroundApp(deps: BackgroundAppDeps = createRealDeps()): void {
  deps.logInfo("AO3 Tag Highlighter background worker loaded.");

  const enqueueMutation = createStorageMutationQueue();
  deps.addMessageListener((message, sendResponse) => {
    if (isStorageMutation(message)) {
      void enqueueMutation(message).then((response) => {
        // The write is done once storage resolves; refreshing tabs is best-effort and must not hold up the sender.
        sendResponse?.(response);
        if (!response.ok) return;
        const type = message.operation === "saveSettings" || message.operation === "resetSettings"
          ? "SETTINGS_UPDATED" : "RULES_UPDATED";
        void broadcastToAo3Tabs(deps, { type }).catch(deps.logError);
      }).catch(deps.logError);
      return true;
    }
    if (!isRuntimeMessage(message)) return;

    sendResponse?.({ ok: true });
    void broadcastToAo3Tabs(deps, message).catch((error) => {
      deps.logError(error);
    });
  });

  // Serialize syncs so a permission change during the startup sync cannot register the script twice.
  let customHostSync = Promise.resolve();
  const scheduleCustomHostSync = (): void => {
    customHostSync = customHostSync.then(() => deps.syncCustomHostScripts()).catch(deps.logError);
  };
  deps.addPermissionsChangedListener(scheduleCustomHostSync);
  scheduleCustomHostSync();

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

  // Send in parallel so a sleeping or unresponsive tab cannot delay the others.
  await Promise.all(tabs.map(async (tab) => {
    if (tab.id == null) return;

    try {
      await deps.sendMessageToTab(tab.id, message);
    } catch {
      // AO3 tabs may not have a ready content script yet.
    }
  }));
}

function createRealDeps(): BackgroundAppDeps {
  return {
    queryAo3Tabs: async () => {
      const tabsApi = getExtensionApi<ChromeLike>().tabs;
      if (!tabsApi) {
        throw new Error("Extension tabs API is unavailable");
      }
      return tabsApi.query({ url: [AO3_ORIGIN_PATTERN, ...await getCustomOriginPatternsSafely()] });
    },
    sendMessageToTab: async (tabId, message) => {
      const tabsApi = getExtensionApi<ChromeLike>().tabs;
      if (!tabsApi) {
        throw new Error("Extension tabs API is unavailable");
      }
      return tabsApi.sendMessage(tabId, message);
    },
    addMessageListener: (callback) => {
      const onMessage = getExtensionApi<ChromeLike>().runtime?.onMessage;
      if (!onMessage) {
        throw new Error("Extension runtime message API is unavailable");
      }

      onMessage.addListener((message, _sender, sendResponse) => {
        return callback(message, sendResponse);
      });
    },
    addInstalledListener: (callback) => {
      getExtensionApi<ChromeLike>().runtime?.onInstalled?.addListener(callback);
    },
    addPermissionsChangedListener: (callback) => {
      const permissionsApi = getExtensionApi<ChromeLike>().permissions;
      permissionsApi?.onAdded?.addListener(callback);
      permissionsApi?.onRemoved?.addListener(callback);
    },
    syncCustomHostScripts: async () => {
      const { permissions: permissionsApi, scripting: scriptingApi } = getExtensionApi<ChromeLike>();
      if (!permissionsApi || !scriptingApi) return;
      await syncCustomHostScripts({
        getGrantedOrigins: async () => (await permissionsApi.getAll()).origins ?? [],
        getContentScriptFiles,
        getRegisteredScripts: (ids) => scriptingApi.getRegisteredContentScripts({ ids }),
        registerScripts: (scripts) => scriptingApi.registerContentScripts(scripts),
        unregisterScripts: (ids) => scriptingApi.unregisterContentScripts({ ids }),
      });
    },
    logInfo: (message) => {
      console.info(message);
    },
    logError: (error) => {
      console.error(`${LOG_PREFIX} Background error:`, error);
    },
  };
}

async function getCustomOriginPatternsSafely(): Promise<string[]> {
  try {
    const permissionsApi = getExtensionApi<ChromeLike>().permissions;
    return getCustomOriginPatterns((await permissionsApi?.getAll())?.origins ?? []);
  } catch (error) {
    console.error(`${LOG_PREFIX} Background error:`, error);
    return [];
  }
}

/** Reuses the manifest's AO3 content script files so custom hosts get the same bundle. */
function getContentScriptFiles(): { js: string[]; css: string[] } {
  const runtime = getExtensionApi<ChromeLike>().runtime;
  const contentScripts = runtime?.getManifest?.().content_scripts ?? [];
  const ao3Script = contentScripts.find((script) => script.matches?.includes(AO3_ORIGIN_PATTERN));
  if (!ao3Script?.js?.length) {
    throw new Error("AO3 content script is missing from the manifest");
  }
  const baseUrl = runtime?.getURL?.("") ?? "";
  const toRelative = (file: string): string => toExtensionRelativePath(file, baseUrl);
  return { js: ao3Script.js.map(toRelative), css: (ao3Script.css ?? []).map(toRelative) };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
