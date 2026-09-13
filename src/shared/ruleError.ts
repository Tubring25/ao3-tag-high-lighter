import { t } from "./i18n";

export function formatRuleSaveError(error: unknown): string {
  if (error instanceof Error && error.message.startsWith("Duplicate rule:")) {
    return t("ruleDuplicate");
  }
  return t("ruleSaveFailed");
}
