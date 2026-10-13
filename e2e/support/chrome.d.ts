// Minimal surface of the extension APIs used inside serviceWorker.evaluate().
declare const chrome: {
  storage: { local: { set(items: Record<string, unknown>): Promise<void> } };
};
