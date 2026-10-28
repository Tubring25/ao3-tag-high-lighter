import type { Rule, Settings } from "../core/types";
import { findExtensionApi } from "../shared/extensionApi";

export interface StorageOperations {
  addRule: { args: [Omit<Rule, "id" | "createdAt" | "updatedAt">]; result: Rule };
  updateRule: { args: [string, Partial<Omit<Rule, "id" | "createdAt">>]; result: Rule };
  deleteRule: { args: [string]; result: void };
  deleteRules: { args: [readonly string[]]; result: void };
  toggleRule: { args: [string]; result: Rule };
  saveSettings: { args: [Partial<Settings>]; result: Settings };
  resetSettings: { args: []; result: Settings };
}

export type StorageMutation = {
  [Operation in keyof StorageOperations]: {
    type: "STORAGE_MUTATION";
    operation: Operation;
    args: StorageOperations[Operation]["args"];
  }
}[keyof StorageOperations];

export type StorageMutationResponse =
  | { ok: true; value?: Rule | Settings | void }
  | { ok: false; error: string };

export async function requestMutation<Operation extends keyof StorageOperations>(
  operation: Operation,
  ...args: StorageOperations[Operation]["args"]
): Promise<StorageOperations[Operation]["result"]> {
  const chromeApi = findExtensionApi<{
    runtime?: { sendMessage(message: unknown): Promise<StorageMutationResponse> };
  }>();
  if (!chromeApi?.runtime) throw new Error("Extension runtime message API is unavailable");
  const response = await chromeApi.runtime.sendMessage({ type: "STORAGE_MUTATION", operation, args });
  if (!response || !response.ok) {
    throw new Error(response?.error ?? "Storage mutation received no response");
  }
  return response.value as StorageOperations[Operation]["result"];
}
