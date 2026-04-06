export type RuntimeMessage =
  | {
      type: "RULES_UPDATED";
    }
  | {
      type: "SETTINGS_UPDATED";
    };
