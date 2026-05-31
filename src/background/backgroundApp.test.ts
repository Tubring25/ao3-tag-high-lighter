import { initBackgroundApp, type BackgroundAppDeps } from "./backgroundApp";

describe("initBackgroundApp", () => {
  it("broadcasts RULES_UPDATED to AO3 tabs", async () => {
    const listenerRef = createListenerRef();
    const { deps, queryAo3Tabs, sendMessageToTab } = createDeps({
      addMessageListener: listenerRef.addMessageListener,
    });

    initBackgroundApp(deps);
    listenerRef.listener?.({ type: "RULES_UPDATED" }, vi.fn());
    await flushAsyncHandlers();

    expect(queryAo3Tabs).toHaveBeenCalledTimes(1);
    expect(sendMessageToTab).toHaveBeenCalledWith(1, { type: "RULES_UPDATED" });
    expect(sendMessageToTab).toHaveBeenCalledWith(2, { type: "RULES_UPDATED" });
  });

  it("broadcasts SETTINGS_UPDATED to AO3 tabs", async () => {
    const listenerRef = createListenerRef();
    const { deps, sendMessageToTab } = createDeps({
      addMessageListener: listenerRef.addMessageListener,
    });

    initBackgroundApp(deps);
    listenerRef.listener?.({ type: "SETTINGS_UPDATED" }, vi.fn());
    await flushAsyncHandlers();

    expect(sendMessageToTab).toHaveBeenCalledWith(1, { type: "SETTINGS_UPDATED" });
    expect(sendMessageToTab).toHaveBeenCalledWith(2, { type: "SETTINGS_UPDATED" });
  });

  it("does not broadcast unknown messages", async () => {
    const listenerRef = createListenerRef();
    const sendResponse = vi.fn();
    const { deps, queryAo3Tabs, sendMessageToTab } = createDeps({
      addMessageListener: listenerRef.addMessageListener,
    });

    initBackgroundApp(deps);
    listenerRef.listener?.({ type: "UNKNOWN" }, sendResponse);
    await flushAsyncHandlers();

    expect(queryAo3Tabs).not.toHaveBeenCalled();
    expect(sendMessageToTab).not.toHaveBeenCalled();
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it("skips tabs without an id", async () => {
    const listenerRef = createListenerRef();
    const { deps, sendMessageToTab } = createDeps({
      addMessageListener: listenerRef.addMessageListener,
      queryAo3Tabs: vi.fn(async () => [{ id: undefined }, {}, { id: 7 }]),
    });

    initBackgroundApp(deps);
    listenerRef.listener?.({ type: "RULES_UPDATED" }, vi.fn());
    await flushAsyncHandlers();

    expect(sendMessageToTab).toHaveBeenCalledTimes(1);
    expect(sendMessageToTab).toHaveBeenCalledWith(7, { type: "RULES_UPDATED" });
  });

  it("continues broadcasting when one tab send fails", async () => {
    const listenerRef = createListenerRef();
    const sendMessageToTab = vi.fn(async (tabId: number) => {
      if (tabId === 1) {
        throw new Error("No receiving end");
      }
    });
    const { deps } = createDeps({
      addMessageListener: listenerRef.addMessageListener,
      sendMessageToTab,
    });

    initBackgroundApp(deps);
    listenerRef.listener?.({ type: "RULES_UPDATED" }, vi.fn());
    await flushAsyncHandlers();

    expect(sendMessageToTab).toHaveBeenCalledWith(1, { type: "RULES_UPDATED" });
    expect(sendMessageToTab).toHaveBeenCalledWith(2, { type: "RULES_UPDATED" });
  });

  it("logs query failures without throwing", async () => {
    const listenerRef = createListenerRef();
    const logError = vi.fn();
    const queryError = new Error("Query failed");
    const { deps, sendMessageToTab } = createDeps({
      addMessageListener: listenerRef.addMessageListener,
      queryAo3Tabs: vi.fn(async () => {
        throw queryError;
      }),
      logError,
    });

    initBackgroundApp(deps);
    expect(() => listenerRef.listener?.({ type: "RULES_UPDATED" }, vi.fn())).not.toThrow();
    await flushAsyncHandlers();

    expect(logError).toHaveBeenCalledWith(queryError);
    expect(sendMessageToTab).not.toHaveBeenCalled();
  });

  it("acknowledges handled messages immediately", () => {
    const listenerRef = createListenerRef();
    const sendResponse = vi.fn();
    const { deps } = createDeps({
      addMessageListener: listenerRef.addMessageListener,
    });

    initBackgroundApp(deps);
    listenerRef.listener?.({ type: "RULES_UPDATED" }, sendResponse);

    expect(sendResponse).toHaveBeenCalledWith({ ok: true });
  });
});

function createDeps(overrides: Partial<BackgroundAppDeps> = {}) {
  const queryAo3Tabs = vi.fn(async () => [{ id: 1 }, { id: undefined }, { id: 2 }]);
  const sendMessageToTab = vi.fn(async () => undefined);
  const addMessageListener = vi.fn();
  const addInstalledListener = vi.fn();
  const logInfo = vi.fn();
  const logError = vi.fn();

  const deps: BackgroundAppDeps = {
    queryAo3Tabs,
    sendMessageToTab,
    addMessageListener,
    addInstalledListener,
    logInfo,
    logError,
    ...overrides,
  };

  return {
    deps,
    queryAo3Tabs: deps.queryAo3Tabs as typeof queryAo3Tabs,
    sendMessageToTab: deps.sendMessageToTab as typeof sendMessageToTab,
    addMessageListener: deps.addMessageListener as typeof addMessageListener,
    addInstalledListener: deps.addInstalledListener as typeof addInstalledListener,
    logInfo: deps.logInfo as typeof logInfo,
    logError: deps.logError as typeof logError,
  };
}

function createListenerRef() {
  let listener: ((message: unknown, sendResponse?: (response: { ok: true }) => void) => void) | null =
    null;
  const addMessageListener = vi.fn(
    (callback: (message: unknown, sendResponse?: (response: { ok: true }) => void) => void) => {
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

async function flushAsyncHandlers(): Promise<void> {
  for (let i = 0; i < 8; i += 1) {
    await Promise.resolve();
  }
}
