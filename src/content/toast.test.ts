import { showToast } from "./toast";

describe("showToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("creates a toast with the provided message", () => {
    showToast("Rule created", { durationMs: 2500 });

    const toast = document.querySelector("[data-ao3th-toast]");
    expect(toast?.textContent).toBe("Rule created");
  });

  it("removes the toast after the configured duration", async () => {
    showToast("Rule created", { durationMs: 100 });

    expect(document.querySelector("[data-ao3th-toast]")).not.toBeNull();

    await vi.advanceTimersByTimeAsync(100);

    expect(document.querySelector("[data-ao3th-toast]")).toBeNull();
  });
});
