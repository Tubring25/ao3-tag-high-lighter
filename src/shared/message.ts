export type RuntimeMessage =
  | {
      type: "RULES_UPDATED";
    }
  | {
      type: "SETTINGS_UPDATED";
    }
  | {
      type: "GET_HIT_STATS";
    };

export interface HitStats {
  highlight: number;
  warn: number;
  hideWork: number;
  totalRules: number;
}
