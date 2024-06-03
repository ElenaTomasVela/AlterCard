import { t } from "elysia";
import mongoose from "mongoose";

export enum HouseRule {
  interjections = "INTERJECTIONS",
  restrictedDraw4 = "RESTRICTED_DRAW_4",
}

export enum DrawHouseRule {
  punishmentDraw = "PUNISHMENT_DRAW",
  drawUntilPlay = "DRAW_UNTIL_PLAY",
}

export enum StackDrawHouseRule {
  progressive = "PROGRESSIVE",
  flat = "FLAT",
  all = "ALL",
}

export enum EndConditionHouseRule {
  lastManStanding = "LAST_MAN_STANDING",
  scoreAfterFirstWin = "SCORE_AFTER_FIRST_WIN",
  scoreAfterFirstWinMercy = "SCORE_AFTER_FIRST_WIN_MERCY",
}

export interface IHouseRuleConfig {
  draw?: DrawHouseRule;
  drawCardStacking?: StackDrawHouseRule;
  endCondition: EndConditionHouseRule;
  generalRules: HouseRule[];
}

export const HouseRuleConfigSchema = new mongoose.Schema<IHouseRuleConfig>({
  draw: {
    type: String,
    enum: Object.values(DrawHouseRule),
  },
  drawCardStacking: {
    type: String,
    enum: Object.values(StackDrawHouseRule),
  },
  endCondition: {
    type: String,
    enum: Object.values(EndConditionHouseRule),
    default: EndConditionHouseRule.lastManStanding,
    required: true,
  },
  generalRules: {
    type: [String],
    enum: Object.values(HouseRule),
    validate: {
      validator: (arr: string[]) => new Set(arr).size == arr.length,
    },
    message: (props: mongoose.ValidatorProps) =>
      `${props.value} has duplicate values`,
  },
});

export const tHouseRuleConfig = t.Object({
  draw: t.Optional(t.Enum(DrawHouseRule)),
  drawCardStacking: t.Optional(t.Enum(StackDrawHouseRule)),
  endCondition: t.Optional(t.Enum(EndConditionHouseRule)),
});
