import { AO3_ORIGIN_PATTERN } from "./constants";

export const AO3_HOST = "archiveofourown.org";

export type CustomHostParseResult =
  | { ok: true; host: string }
  | { ok: false; reason: "empty" | "invalid" | "ao3" };

const HOST_LABEL = "[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?";
const HOST_PATTERN = new RegExp(`^(?=.{1,253}$)${HOST_LABEL}(?:\\.${HOST_LABEL})+$`);
const CUSTOM_ORIGIN_PATTERN = /^https:\/\/([^/*:]+)\/\*$/;

export function isAo3Host(host: string): boolean {
  return host === AO3_HOST || host.endsWith(`.${AO3_HOST}`);
}

/** Accepts a bare host or a pasted URL and returns its lowercase hostname. */
export function parseCustomHostInput(input: string): CustomHostParseResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, reason: "empty" };
  if (trimmed.includes("*")) return { ok: false, reason: "invalid" };

  let url: URL;
  try {
    url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return { ok: false, reason: "invalid" };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false, reason: "invalid" };

  const host = url.hostname.replace(/\.$/, "");
  if (!HOST_PATTERN.test(host)) return { ok: false, reason: "invalid" };
  if (isAo3Host(host)) return { ok: false, reason: "ao3" };
  return { ok: true, host };
}

export function toCustomOriginPattern(host: string): string {
  return `https://${host}/*`;
}

/** Extracts user-enabled hosts from granted origins, ignoring AO3 and wildcard grants. */
export function getCustomHosts(origins: readonly string[]): string[] {
  const hosts = new Set<string>();
  for (const origin of origins) {
    if (origin === AO3_ORIGIN_PATTERN) continue;
    const host = CUSTOM_ORIGIN_PATTERN.exec(origin)?.[1];
    if (host && HOST_PATTERN.test(host) && !isAo3Host(host)) hosts.add(host);
  }
  return [...hosts].sort();
}

export function getCustomOriginPatterns(origins: readonly string[]): string[] {
  return getCustomHosts(origins).map(toCustomOriginPattern);
}
