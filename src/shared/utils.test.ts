import { debounce } from "./utils";

describe("debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not run before the delay", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);

    debounced();
    vi.advanceTimersByTime(199);

    expect(fn).not.toHaveBeenCalled();
  });

  it("runs only the last call after repeated calls", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);

    debounced("first");
    vi.advanceTimersByTime(100);
    debounced("second");
    vi.advanceTimersByTime(200);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("second");
  });

  it("passes all arguments to the wrapped function", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 50);

    debounced("tag", 42, true);
    vi.advanceTimersByTime(50);

    expect(fn).toHaveBeenCalledWith("tag", 42, true);
  });
});
