import { getCustomOriginPatterns } from "../shared/customHosts";

export const CUSTOM_HOST_SCRIPT_ID = "ao3th-custom-hosts";

export interface CustomHostContentScript {
  id: string;
  matches?: string[];
  js?: string[];
  css?: string[];
}

export interface CustomHostScriptsApi {
  getGrantedOrigins(): Promise<string[]>;
  getContentScriptFiles(): { js: string[]; css: string[] };
  getRegisteredScripts(ids: string[]): Promise<CustomHostContentScript[]>;
  registerScripts(scripts: CustomHostContentScript[]): Promise<void>;
  unregisterScripts(ids: string[]): Promise<void>;
}

/**
 * Registers the AO3 content script on every custom host the browser has granted.
 * Granted permissions are the only source of truth, so this runs on each background start
 * and whenever permissions change.
 */
export async function syncCustomHostScripts(api: CustomHostScriptsApi): Promise<void> {
  const matches = getCustomOriginPatterns(await api.getGrantedOrigins());
  const { js, css } = api.getContentScriptFiles();
  const [registered] = await api.getRegisteredScripts([CUSTOM_HOST_SCRIPT_ID]);

  if (
    registered &&
    sameItems(registered.matches, matches) &&
    sameItems(registered.js, js) &&
    sameItems(registered.css, css)
  ) {
    return;
  }

  if (registered) await api.unregisterScripts([CUSTOM_HOST_SCRIPT_ID]);
  if (matches.length === 0) return;
  await api.registerScripts([{ id: CUSTOM_HOST_SCRIPT_ID, matches, js, css }]);
}

/**
 * Firefox's runtime.getManifest() returns content script files as absolute moz-extension URLs,
 * but scripting.registerContentScripts only accepts paths relative to the extension root.
 */
export function toExtensionRelativePath(file: string, extensionBaseUrl: string): string {
  const relative = file.startsWith(extensionBaseUrl) ? file.slice(extensionBaseUrl.length) : file;
  return relative.replace(/^\/+/, "");
}

function sameItems(left: readonly string[] = [], right: readonly string[] = []): boolean {
  if (left.length !== right.length) return false;
  const sortedRight = [...right].sort();
  return [...left].sort().every((item, index) => item === sortedRight[index]);
}
