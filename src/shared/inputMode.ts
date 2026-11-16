export type QuickAddInputMode = "pointer" | "touch";

const TOUCH_QUERY = "(hover: none) and (pointer: coarse)";

export function detectInputMode(win: Window = window): QuickAddInputMode {
  return win.matchMedia?.(TOUCH_QUERY).matches ? "touch" : "pointer";
}

export function watchInputMode(onChange: (mode: QuickAddInputMode) => void, win: Window = window): () => void {
  const query = win.matchMedia?.(TOUCH_QUERY);
  if (!query) return () => {};
  const listener = () => onChange(detectInputMode(win));
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}
