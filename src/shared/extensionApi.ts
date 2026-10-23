type ExtensionScope = typeof globalThis & { browser?: unknown; chrome?: unknown };

export function findExtensionApi<T>(): T | undefined {
  const scope = globalThis as ExtensionScope;
  // Chrome content scripts can see `window.browser` from a page element with id="browser".
  const browserApi = isExtensionNamespace(scope.browser) ? scope.browser : undefined;
  return (browserApi ?? scope.chrome) as T | undefined;
}

export function getExtensionApi<T>(): T {
  const api = findExtensionApi<T>();
  if (!api) throw new Error("Extension API is unavailable");
  return api;
}

function isExtensionNamespace(value: unknown): boolean {
  return typeof value === "object" && value !== null && "runtime" in value;
}
