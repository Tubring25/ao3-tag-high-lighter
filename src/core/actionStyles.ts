import type { CustomizableRuleAction, RuleAction, RuleActionStyle, RuleActionStyles } from "./types";

export interface RuleActionStylePreset extends RuleActionStyle {
  name: string;
}

export const DEFAULT_ACTION_STYLES: RuleActionStyles = {
  highlight: {
    label: "Highlight",
    backgroundColor: "#fff3db",
    textColor: "#111111",
  },
  warn: {
    label: "Warning",
    backgroundColor: "#f5e9e7",
    textColor: "#990000",
  },
};

export const ACTION_STYLE_PRESETS: Record<CustomizableRuleAction, readonly RuleActionStylePreset[]> = {
  highlight: [
    {
      name: "Butter",
      label: "Highlight",
      backgroundColor: "#fff4d8",
      textColor: "#5f3b00",
    },
    {
      name: "Mint",
      label: "Highlight",
      backgroundColor: "#e7f4ec",
      textColor: "#14532d",
    },
    {
      name: "Sky",
      label: "Highlight",
      backgroundColor: "#e8f1fb",
      textColor: "#1e3a5f",
    },
  ],
  warn: [
    {
      name: "Rose",
      label: "Warning",
      backgroundColor: "#f4e6e3",
      textColor: "#990000",
    },
    {
      name: "Amber",
      label: "Warning",
      backgroundColor: "#faead2",
      textColor: "#7c2d12",
    },
    {
      name: "Mauve",
      label: "Warning",
      backgroundColor: "#eee7f6",
      textColor: "#5b2a69",
    },
  ],
};

export function getActionLabel(
  action: RuleAction,
  actionStyles: RuleActionStyles = DEFAULT_ACTION_STYLES
): string {
  if (action === "hideWork") return "Collapse work";
  return actionStyles[action].label;
}
