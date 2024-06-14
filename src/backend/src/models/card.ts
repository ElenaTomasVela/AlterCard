import mongoose from "mongoose";
import { HouseRule } from "./houseRule";

export enum CardColor {
  red = "RED",
  green = "GREEN",
  blue = "BLUE",
  yellow = "YELLOW",
  wild = "WILD",
}

export enum CardSymbol {
  zero = "ZERO",
  one = "ONE",
  two = "TWO",
  three = "THREE",
  four = "FOUR",
  five = "FIVE",
  six = "SIX",
  seven = "SEVEN",
  eight = "EIGHT",
  nine = "NINE",
  draw2 = "DRAW_2",
  draw4 = "DRAW_4",
  skipTurn = "SKIP_TURN",
  reverseTurn = "REVERSE_TURN",
  changeColor = "CHANGE_COLOR",
}

export function getCardScore(
  card: ICard,
  modifierRules: HouseRule[] = [],
): number {
  if (card.color === CardColor.wild) return 50;

  switch (card.symbol) {
    case CardSymbol.zero:
      return modifierRules.includes(HouseRule.redZeroOfDeath) &&
        card.color === CardColor.red
        ? 125
        : 0;
    case CardSymbol.one:
      return 1;
    case CardSymbol.two:
      return 2;
    case CardSymbol.three:
      return 3;
    case CardSymbol.four:
      return 4;
    case CardSymbol.five:
      return 5;
    case CardSymbol.six:
      return 6;
    case CardSymbol.seven:
      return 7;
    case CardSymbol.eight:
      return 8;
    case CardSymbol.nine:
      return 9;
    default:
      return 20;
  }
}

export interface ICard {
  symbol: CardSymbol;
  color: CardColor;
}

const CardSchema = new mongoose.Schema<ICard>({
  symbol: {
    type: String,
    enum: Object.values(CardSymbol),
  },
  color: {
    type: String,
    enum: Object.values(CardColor),
  },
});

const CardDeckSchema = new mongoose.Schema({
  name: String,
  description: String,
  cards: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Card",
    },
  ],
});

export const Card = mongoose.model("Card", CardSchema);
export const CardDeck = mongoose.model("CardDeck", CardDeckSchema);
