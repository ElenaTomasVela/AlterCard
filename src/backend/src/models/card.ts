import mongoose from "mongoose";

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
}

const CardSchema = new mongoose.Schema({
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
  cards: [CardSchema],
});

export const Card = mongoose.model("Card", CardSchema);
export const CardDeck = mongoose.model("CardDeck", CardDeckSchema);
