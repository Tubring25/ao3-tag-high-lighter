export type RuleAction = "highlight" | "warn" | "mute" | "hideWork";

export type MatchMode = "exact" | "contains" | "wildcard";

export type TagCategory = "relationship" | "character" | "freeform" | "all";

export type ParsedTagCategory = Exclude<TagCategory, "all">;

export type RuleSource = "manual" | "quickAdd";

export type HideWorkMode = "collapse" | "hide";

export interface Rule {
  id: string;
  label?: string;
  pattern: string;
  action: RuleAction;
  matchMode: MatchMode;
  category: TagCategory;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  note?: string;
  groupId?: string | null;
  source?: RuleSource;
}

export interface Settings {
  extensionEnabled: boolean;
  hoverButtonEnabled: boolean;
  showToast: boolean;
  hideWorkMode: HideWorkMode;
  enableOnWorkDetailPage: boolean;
}

export interface ParsedTag {
  id: string;
  text: string;
  normalizedText: string;
  category: ParsedTagCategory;
  element: HTMLElement;
  workId: string;
}

export interface ParsedWork {
  id: string;
  element: HTMLElement;
  tags: ParsedTag[];
}

export interface TagMatch {
  tagId: string;
  ruleId: string;
  action: RuleAction;
}

export interface WorkMatchSummary {
  workId: string;
  matchedRuleIds: string[];
  hasWarn: boolean;
  hasHideWork: boolean;
}

export interface MatchResult {
  tagMatches: TagMatch[];
  workSummaries: WorkMatchSummary[];
}
