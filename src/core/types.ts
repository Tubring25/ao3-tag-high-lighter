export type RuleAction = "highlight" | "warn" | "hideWork";

export type CustomizableRuleAction = Exclude<RuleAction, "hideWork">;

export type MatchMode = "exact" | "contains" | "wildcard";

export type TagCategory = "relationship" | "character" | "freeform" | "all";

export type ParsedTagCategory = Exclude<TagCategory, "all">;

export type RuleSource = "manual" | "quickAdd";

export type HideWorkMode = "collapse" | "hide";

export type LanguagePreference = "auto" | "en" | "zh_CN";

export interface RuleActionStyle {
  label: string;
  backgroundColor: string;
  textColor: string;
}

export type RuleActionStyles = Record<CustomizableRuleAction, RuleActionStyle>;

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
  languagePreference: LanguagePreference;
  actionStyles: RuleActionStyles;
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
  isWorkDetailPage?: boolean;
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
