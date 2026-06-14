import { DEFAULT_ACTION_STYLES } from "../core/actionStyles";
import type {
  CustomizableRuleAction,
  LanguagePreference,
  RuleAction,
  RuleActionStyle,
  RuleActionStyles,
} from "../core/types";

const EN_MESSAGES = {
  extensionName: "AO3 Tag Highlighter",
  extensionDescription: "Mark AO3 tags, show warnings, and collapse works with your own tag rules.",
  actionHighlight: "Highlight",
  actionWarning: "Warning",
  actionWarn: "Warn",
  actionCollapse: "Collapse",
  actionCollapseWork: "Collapse work",
  actionHighlightTag: "Highlight tag",
  actionWarnWork: "Warn work",
  actionCustomTag: "$1 tag",
  actionCustomWork: "$1 work",
  labelOn: "On",
  labelOff: "Off",
  labelPaused: "Paused",
  labelEnabled: "Enabled",
  labelExact: "Exact",
  labelContains: "Contains",
  labelWildcard: "Wildcard",
  languageLabel: "Language",
  languageAuto: "Auto",
  languageEnglish: "English",
  languageChineseSimplified: "简体中文",
  categoryAny: "Any category",
  categoryAll: "all",
  categoryRelationship: "relationship",
  categoryCharacter: "character",
  categoryFreeform: "freeform",
  popupExtensionEnabledAria: "Extension enabled",
  popupSettingsLoadErrorTitle: "Settings could not load.",
  popupSettingsLoadErrorBody: "Try reopening the popup, or open Manage rules.",
  popupOpenAo3PageTitle: "Open an AO3 page.",
  popupOpenAo3PageBody: "Matches will appear here.",
  popupPausedTitle: "Extension paused.",
  popupPausedMatchesBody: "Matches found. Turn on the extension to apply styles.",
  popupPausedEmptyBody: "Turn on the extension to highlight, warn, or caution works.",
  popupNoMatchesTitle: "No rule matches on this page yet.",
  popupNoMatchesBody: "Use Manage rules or hover AO3 tags to add rules.",
  popupMatchesTitle: "$1 matches on this page",
  popupStylesActiveBody: "Styles are active on this page.",
  popupStatHighlightTags: "$1 tags",
  popupStatCaution: "Caution",
  popupManageRules: "Manage rules",
  popupTagHoverQuickAdd: "Tag hover quick-add",
  popupTagHoverQuickAddDescription: "Show the + button next to AO3 tags.",
  popupTagHoverQuickAddEnabledAria: "Tag hover quick-add enabled",
  popupSaveError: "Could not save. Try again.",
  popupCurrentTab: "Current tab",
  popupAo3WorkPage: "AO3 work page",
  popupAo3Page: "AO3 page",
  optionsEyebrow: "AO3 Tag Highlighter",
  optionsTitle: "Rules manager",
  optionsSubtitle: "Manage how AO3 tags are highlighted, marked, or collapsed.",
  optionsRulesCount: "$1 rules",
  optionsRuleSettings: "Rule settings",
  optionsRules: "Rules",
  optionsNavEnabled: "Enabled",
  optionsNavPaused: "Paused",
  optionsSavedInBrowser: "Saved in this browser.",
  optionsRulesSubtitle: "Find and update your rules.",
  optionsAddRule: "+ Add rule",
  optionsUserGuide: "User guide",
  optionsTagStyles: "Tag styles",
  optionsSearchPlaceholder: "Search tags...",
  optionsAllActions: "All actions",
  optionsAllCategories: "All categories",
  optionsAllStatus: "All status",
  optionsTablePattern: "Pattern",
  optionsTableAction: "Action",
  optionsTableMatch: "Match",
  optionsTableCategory: "Category",
  optionsTableStatus: "Status",
  optionsNoRulesTitle: "No rules yet",
  optionsNoMatchingRulesTitle: "No matching rules",
  optionsNoRulesBody: "Add a tag rule to highlight, warn, or collapse works.",
  optionsNoMatchingRulesBody: "Try another search or clear filters.",
  optionsClearFilters: "Clear filters",
  optionsDisableRule: "Disable rule",
  optionsEnableRule: "Enable rule",
  optionsEdit: "Edit",
  optionsDelete: "Delete",
  optionsEditingRule: "Editing “$1”",
  optionsNewRule: "New rule",
  optionsEditSelectedRule: "Edit selected rule",
  optionsCreateRule: "Create rule",
  optionsEditHint: "Save changes to update matching AO3 pages.",
  optionsCreateHint: "Choose a tag and what should happen.",
  optionsFieldPattern: "Pattern",
  optionsFieldAction: "Action",
  optionsFieldMatchMode: "Match mode",
  optionsFieldCategory: "Category",
  optionsSave: "Save",
  optionsCreate: "Create",
  optionsTagAppearance: "Tag appearance",
  optionsTagStylesHint: "These styles apply to all rules with this action.",
  optionsStyleLabel: "Label",
  optionsStyleBackground: "BG",
  optionsStyleText: "Text",
  optionsRecommendedPalettes: "Recommended palettes",
  optionsCollapseAlwaysFixed: "Always uses the collapse style.",
  optionsLocked: "Locked",
  optionsOperationFailed: "Operation failed",
  optionsDeleteConfirm: "Delete rule \"$1\"?",
  optionsSelectedCount: "$1 selected",
  optionsSelectRule: "Select rule “$1”",
  optionsSelectAllRules: "Select all visible rules",
  optionsDeleteSelected: "Delete selected",
  optionsBulkDeleteConfirm: "Delete $1 selected rules?",
  presetButter: "Butter",
  presetMint: "Mint",
  presetSky: "Sky",
  presetRose: "Rose",
  presetAmber: "Amber",
  presetMauve: "Mauve",
  hoverQuickAddAria: "Quick add AO3 tag rule",
  hoverMenuAria: "Quick add tag rule",
  hoverAddRuleFor: "Add rule for “$1”",
  toastRuleCreated: "Rule created: $1",
  contentWarnBanner: "This work contains warning tags.",
  contentWarningMessage: "This work contains warning tags: $1.",
  contentCautionNoReasons: "Caution: This work matches tags you usually hide from listings.",
  contentCautionMessage: "Caution: This work matches tags you usually hide from listings: $1.",
  contentCollapsedExpanded: "Collapsed work is expanded for this page.",
  contentHideAgain: "Hide again",
  contentClickToExpand: "Click to expand",
  contentCollapsedNoReasons: "This work is collapsed by a hideWork rule.",
  contentCollapsedOneReason: "This work is collapsed by a hideWork rule: $1",
  contentCollapsedMultipleReasons: "This work is collapsed by hideWork rules: $1",
  guideEyebrow: "AO3 Tag Highlighter Guide",
  guideTitle: "See what a tag rule changes.",
  guideLede: "Try the preview, then read the rule basics below.",
  guideTryIt: "Try it",
  guideBackToOptions: "Back to options",
  guideControls: "Controls",
  guideControlsHint: "Adjust the sample rule.",
  guideTag: "Tag",
  guideAction: "Action",
  guideMatchMode: "Match mode",
  guideExactSummary: "Matches the whole AO3 tag only.",
  guideExactBestFor: "Best first choice for copied AO3 tags.",
  guideContainsSummary: "Matches tags that include this word or phrase.",
  guideContainsBestFor: "Use for broad themes that appear in many tag names.",
  guideWildcardSummary: "Use * when part of the tag may change.",
  guideWildcardBestFor: "Use when the beginning or ending may vary.",
  guideTextBeforeStar: "Text before *",
  guideTextAfterStar: "Text after *",
  guidePattern: "Pattern",
  guideMatches: "Matches",
  guideSkips: "Skips",
  guideLivePreview: "Live AO3-style preview",
  guideResultHighlight: "The tag gets a quiet color marker so it is easy to scan.",
  guideResultWarn: "The work stays visible, with a warning bar above the metadata.",
  guideResultCollapse: "The work collapses on listing pages and shows the matched reason.",
  guideMetaWords: "Words",
  guideMetaChapters: "Chapters",
  guideMetaKudos: "Kudos",
  guideMatchingModesTitle: "Matching modes",
  guideMatchingModesBody: "Choose how closely a rule pattern should match AO3 tag text.",
  guideNextTitle: "What to do next",
  guideStepAo3Title: "On AO3",
  guideStepAo3Body: "Hover a tag, click +, then choose Highlight, Warning, or Collapse.",
  guideStepSafeTitle: "Start safe",
  guideStepSafeBody: "Use Exact for copied AO3 tags. Try Contains or Wildcard only when you need broader matches.",
  guideStepTuneTitle: "Tune later",
  guideStepTuneBody: "Use Manage rules to edit colors, pause rules, or change match modes.",
} as const;

const ZH_CN_MESSAGES: Record<MessageKey, string> = {
  extensionName: "AO3 Tag Highlighter",
  extensionDescription: "用自己的标签规则标记 AO3 标签、显示提醒并折叠作品。",
  actionHighlight: "高亮",
  actionWarning: "提醒",
  actionWarn: "提醒",
  actionCollapse: "折叠",
  actionCollapseWork: "折叠作品",
  actionHighlightTag: "高亮标签",
  actionWarnWork: "提醒作品",
  actionCustomTag: "$1 标签",
  actionCustomWork: "$1 作品",
  labelOn: "开启",
  labelOff: "关闭",
  labelPaused: "暂停",
  labelEnabled: "启用",
  labelExact: "精确",
  labelContains: "包含",
  labelWildcard: "通配符",
  languageLabel: "语言",
  languageAuto: "自动",
  languageEnglish: "English",
  languageChineseSimplified: "简体中文",
  categoryAny: "任意分类",
  categoryAll: "全部",
  categoryRelationship: "关系",
  categoryCharacter: "角色",
  categoryFreeform: "自由标签",
  popupExtensionEnabledAria: "启用扩展",
  popupSettingsLoadErrorTitle: "设置没有载入。",
  popupSettingsLoadErrorBody: "重新打开弹窗，或去规则管理查看。",
  popupOpenAo3PageTitle: "先打开 AO3 页面。",
  popupOpenAo3PageBody: "当前页命中的规则会显示在这里。",
  popupPausedTitle: "已暂停。",
  popupPausedMatchesBody: "当前页有命中规则。开启后会显示标记。",
  popupPausedEmptyBody: "开启后会按规则标记作品。",
  popupNoMatchesTitle: "当前页没有命中规则。",
  popupNoMatchesBody: "可以在规则管理里添加，或悬停标签点 +。",
  popupMatchesTitle: "当前页命中 $1 项",
  popupStylesActiveBody: "标记已显示在页面上。",
  popupStatHighlightTags: "$1标签",
  popupStatCaution: "隐藏提醒",
  popupManageRules: "管理规则",
  popupTagHoverQuickAdd: "悬停标签时显示 +",
  popupTagHoverQuickAddDescription: "用 + 快速添加这枚标签的规则。",
  popupTagHoverQuickAddEnabledAria: "启用悬停标签快速添加",
  popupSaveError: "保存失败，请重试。",
  popupCurrentTab: "当前标签页",
  popupAo3WorkPage: "AO3 作品页",
  popupAo3Page: "AO3 页面",
  optionsEyebrow: "AO3 Tag Highlighter",
  optionsTitle: "规则管理",
  optionsSubtitle: "管理 AO3 标签的高亮、提醒和折叠规则。",
  optionsRulesCount: "$1 条规则",
  optionsRuleSettings: "规则设置",
  optionsRules: "规则",
  optionsNavEnabled: "已启用",
  optionsNavPaused: "已暂停",
  optionsSavedInBrowser: "保存在当前浏览器。",
  optionsRulesSubtitle: "查找并更新你的规则。",
  optionsAddRule: "+ 添加规则",
  optionsUserGuide: "使用指南",
  optionsTagStyles: "标签样式",
  optionsSearchPlaceholder: "搜索标签...",
  optionsAllActions: "全部效果",
  optionsAllCategories: "全部分类",
  optionsAllStatus: "全部状态",
  optionsTablePattern: "匹配文本",
  optionsTableAction: "效果",
  optionsTableMatch: "匹配",
  optionsTableCategory: "分类",
  optionsTableStatus: "状态",
  optionsNoRulesTitle: "还没有规则",
  optionsNoMatchingRulesTitle: "没有匹配的规则",
  optionsNoRulesBody: "添加一条标签规则，用来高亮、提醒或折叠作品。",
  optionsNoMatchingRulesBody: "换个搜索条件，或清除筛选。",
  optionsClearFilters: "清除筛选",
  optionsDisableRule: "停用规则",
  optionsEnableRule: "启用规则",
  optionsEdit: "编辑",
  optionsDelete: "删除",
  optionsEditingRule: "正在编辑“$1”",
  optionsNewRule: "新规则",
  optionsEditSelectedRule: "编辑选中的规则",
  optionsCreateRule: "创建规则",
  optionsEditHint: "保存修改后会更新匹配的 AO3 页面。",
  optionsCreateHint: "选择标签，以及匹配后要发生什么。",
  optionsFieldPattern: "匹配文本",
  optionsFieldAction: "效果",
  optionsFieldMatchMode: "匹配方式",
  optionsFieldCategory: "分类",
  optionsSave: "保存",
  optionsCreate: "创建",
  optionsTagAppearance: "标签外观",
  optionsTagStylesHint: "这些样式会应用到同类规则。",
  optionsStyleLabel: "名称",
  optionsStyleBackground: "背景",
  optionsStyleText: "文字",
  optionsRecommendedPalettes: "推荐配色",
  optionsCollapseAlwaysFixed: "始终使用固定折叠样式。",
  optionsLocked: "固定",
  optionsOperationFailed: "操作失败",
  optionsDeleteConfirm: "删除规则“$1”？",
  optionsSelectedCount: "已选择 $1 条",
  optionsSelectRule: "选择规则“$1”",
  optionsSelectAllRules: "选择当前显示的全部规则",
  optionsDeleteSelected: "删除选中项",
  optionsBulkDeleteConfirm: "删除选中的 $1 条规则？",
  presetButter: "奶油",
  presetMint: "薄荷",
  presetSky: "天空",
  presetRose: "玫瑰",
  presetAmber: "琥珀",
  presetMauve: "淡紫",
  hoverQuickAddAria: "快速添加这枚 AO3 标签",
  hoverMenuAria: "快速添加标签规则",
  hoverAddRuleFor: "给“$1”添加规则",
  toastRuleCreated: "已添加规则：$1",
  contentWarnBanner: "这篇作品包含需要留意的标签。",
  contentWarningMessage: "这篇作品包含需要留意的标签：$1。",
  contentCautionNoReasons: "注意：这篇作品含有你在列表页选择隐藏的标签。",
  contentCautionMessage: "注意：这篇作品含有你在列表页选择隐藏的标签：$1。",
  contentCollapsedExpanded: "这篇折叠作品已临时展开。",
  contentHideAgain: "重新折叠",
  contentClickToExpand: "展开",
  contentCollapsedNoReasons: "这篇作品已按隐藏规则折叠。",
  contentCollapsedOneReason: "这篇作品已按隐藏规则折叠：$1",
  contentCollapsedMultipleReasons: "这篇作品已按隐藏规则折叠：$1",
  guideEyebrow: "AO3 Tag Highlighter 使用指南",
  guideTitle: "规则会怎样改变 AO3 页面",
  guideLede: "用示例快速了解高亮、提醒和折叠。",
  guideTryIt: "试试看",
  guideBackToOptions: "返回配置页",
  guideControls: "试一条规则",
  guideControlsHint: "选择标签和处理方式，左侧预览会同步变化。",
  guideTag: "标签",
  guideAction: "处理方式",
  guideMatchMode: "匹配方式",
  guideExactSummary: "完整匹配一个 AO3 标签。",
  guideExactBestFor: "从 AO3 复制标签时优先使用。",
  guideContainsSummary: "只要标签里包含这个词或短语，就会匹配。",
  guideContainsBestFor: "适合主题词，比如 Violence。",
  guideWildcardSummary: "用 * 表示可以变化的文字。",
  guideWildcardBestFor: "适合开头或结尾会变化的标签。",
  guideTextBeforeStar: "固定开头",
  guideTextAfterStar: "固定结尾",
  guidePattern: "规则文本",
  guideMatches: "会匹配",
  guideSkips: "不会匹配",
  guideLivePreview: "AO3 页面预览",
  guideResultHighlight: "标签会用淡色标出来，方便快速扫视。",
  guideResultWarn: "作品会保留显示，并在上方出现提醒条。",
  guideResultCollapse: "列表页会先折叠作品，并显示触发原因。",
  guideMetaWords: "字数",
  guideMetaChapters: "章节",
  guideMetaKudos: "Kudos",
  guideMatchingModesTitle: "匹配方式",
  guideMatchingModesBody: "选择规则要怎样匹配 AO3 标签。",
  guideNextTitle: "下一步",
  guideStepAo3Title: "在 AO3 添加",
  guideStepAo3Body: "悬停标签，点击 +，选择高亮、提醒或折叠。",
  guideStepSafeTitle: "先用精确匹配",
  guideStepSafeBody: "直接复制 AO3 标签时，先选精确匹配。需要更宽泛时，再用包含或通配符。",
  guideStepTuneTitle: "之后再微调",
  guideStepTuneBody: "回到规则管理，可以改颜色、暂停规则或调整匹配方式。",
};

export type MessageKey = keyof typeof EN_MESSAGES;

let activeLanguagePreference: LanguagePreference = "auto";

type ChromeI18nLike = {
  i18n?: {
    getMessage(key: string, substitutions?: string | string[]): string;
  };
};

export function t(key: MessageKey, substitutions: ReadonlyArray<string | number> = []): string {
  if (activeLanguagePreference === "auto") {
    const chromeMessage = getChromeMessage(key, substitutions);
    if (chromeMessage) return chromeMessage;
  }

  const messages = getActiveLocale().startsWith("zh") ? ZH_CN_MESSAGES : EN_MESSAGES;
  return formatMessage(messages[key] ?? EN_MESSAGES[key], substitutions);
}

export function setLanguagePreference(preference: LanguagePreference): void {
  activeLanguagePreference = preference;
}

export function applyDocumentLanguage(): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = getEffectiveLanguageTag();
}

export function getEffectiveLanguageTag(): "en" | "zh-CN" {
  return getActiveLocale().startsWith("zh") ? "zh-CN" : "en";
}

export function getLocalizedActionLabel(
  action: RuleAction,
  actionStyles: RuleActionStyles
): string {
  if (action === "hideWork") return t("actionCollapseWork");
  return getLocalizedCustomizableActionLabel(action, actionStyles[action]);
}

export function getLocalizedCustomizableActionLabel(
  action: CustomizableRuleAction,
  style: RuleActionStyle
): string {
  if (style.label === DEFAULT_ACTION_STYLES[action].label) {
    return action === "highlight" ? t("actionHighlight") : t("actionWarning");
  }
  return style.label;
}

export function getLocalizedPresetName(name: string): string {
  const key = `preset${name}` as MessageKey;
  return key in EN_MESSAGES ? t(key) : name;
}

function getChromeMessage(
  key: MessageKey,
  substitutions: ReadonlyArray<string | number>
): string {
  const chromeApi = (globalThis as typeof globalThis & { chrome?: ChromeI18nLike }).chrome;
  const values = substitutions.map(String);
  return chromeApi?.i18n?.getMessage(key, values.length <= 1 ? values[0] : values) ?? "";
}

function getActiveLocale(): string {
  if (activeLanguagePreference !== "auto") return activeLanguagePreference;
  return getFallbackLocale();
}

function getFallbackLocale(): string {
  return globalThis.navigator?.language ?? "en";
}

function formatMessage(message: string, substitutions: ReadonlyArray<string | number>): string {
  return substitutions.reduce<string>(
    (formatted, value, index) => formatted.replaceAll(`$${index + 1}`, String(value)),
    message
  );
}
