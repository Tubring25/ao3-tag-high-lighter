export interface ToastOptions {
  durationMs?: number;
}

const DEFAULT_DURATION_MS = 2500;

export function showToast(message: string, options: ToastOptions = {}): void {
  const toast = document.createElement("div");
  toast.className = "ao3th-toast";
  toast.dataset.ao3thToast = "true";
  toast.textContent = message;

  ensureToastContainer().appendChild(toast);

  setTimeout(() => {
    toast.remove();
    removeEmptyContainer();
  }, options.durationMs ?? DEFAULT_DURATION_MS);
}

function ensureToastContainer(): HTMLElement {
  const existing = document.querySelector<HTMLElement>("[data-ao3th-toast-container]");
  if (existing) return existing;

  const container = document.createElement("div");
  container.className = "ao3th-toast-container";
  container.dataset.ao3thToastContainer = "true";
  document.body.appendChild(container);
  return container;
}

function removeEmptyContainer(): void {
  const container = document.querySelector("[data-ao3th-toast-container]");
  if (container && container.childElementCount === 0) {
    container.remove();
  }
}
