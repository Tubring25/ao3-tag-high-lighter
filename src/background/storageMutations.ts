import { ruleMutationHandlers } from "../storage/ruleStorage";
import { settingsMutationHandlers } from "../storage/settingsStorage";
import type { StorageMutation, StorageMutationResponse } from "../storage/mutationClient";

export function isStorageMutation(message: unknown): message is StorageMutation {
  if (typeof message !== "object" || message === null) return false;
  const candidate = message as Partial<StorageMutation>;
  return candidate.type === "STORAGE_MUTATION" &&
    typeof candidate.operation === "string" &&
    Object.hasOwn(handlers, candidate.operation) && Array.isArray(candidate.args);
}

const handlers = { ...ruleMutationHandlers, ...settingsMutationHandlers };

export function createStorageMutationQueue(): (message: StorageMutation) => Promise<StorageMutationResponse> {
  let tail: Promise<unknown> = Promise.resolve();
  return (message) => {
    const result = tail.then(async (): Promise<StorageMutationResponse> => {
      try {
        return { ok: true, value: await executeMutation(message) };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    });
    tail = result;
    return result;
  };
}

function executeMutation(message: StorageMutation) {
  switch (message.operation) {
    case "addRule": return handlers.addRule(...message.args);
    case "updateRule": return handlers.updateRule(...message.args);
    case "deleteRule": return handlers.deleteRule(...message.args);
    case "deleteRules": return handlers.deleteRules(...message.args);
    case "toggleRule": return handlers.toggleRule(...message.args);
    case "saveSettings": return handlers.saveSettings(...message.args);
    case "resetSettings": return handlers.resetSettings(...message.args);
  }
}
