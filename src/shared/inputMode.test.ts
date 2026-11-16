import { detectInputMode, watchInputMode } from "./inputMode";

describe("inputMode", () => {
  it("detects touch when the coarse no-hover query matches", () => {
    const { win } = createWindow(true);
    expect(detectInputMode(win)).toBe("touch");
  });

  it("detects pointer when the query does not match", () => {
    const { win } = createWindow(false);
    expect(detectInputMode(win)).toBe("pointer");
  });

  it("falls back to pointer and a no-op watcher without matchMedia", () => {
    const win = {} as Window;
    expect(detectInputMode(win)).toBe("pointer");
    const onChange = vi.fn();
    expect(() => watchInputMode(onChange, win)()).not.toThrow();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("reports the new mode on change and stops after unsubscribe", () => {
    const { win, query, setMatches } = createWindow(false);
    const onChange = vi.fn();
    const stop = watchInputMode(onChange, win);

    setMatches(true);
    query.dispatch();
    expect(onChange).toHaveBeenLastCalledWith("touch");

    stop();
    setMatches(false);
    query.dispatch();
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

function createWindow(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<() => void>();
  const query = {
    get matches() {
      return matches;
    },
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    dispatch: () => listeners.forEach((listener) => listener()),
  };
  const win = { matchMedia: () => query } as unknown as Window;
  return { win, query, setMatches: (next: boolean) => { matches = next; } };
}
