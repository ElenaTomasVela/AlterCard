import mongoose from "mongoose";

const CardSchema = new mongoose.Schema({
  symbol: {
    type: String,
    enum: [
      "ZERO",
      "ONE",
      "TWO",
      "THREE",
      "FOUR",
      "FIVE",
      "SIX",
      "SEVEN",
      "EIGHT",
      "NINE",
      "DRAW_2",
      "DRAW_4",
      "SKIP_TURN",
      "REVERSE_TURN",
    ],
  },
  color: {
    type: String,
    enum: ["RED", "GREEN", "BLUE", "YELLOW", "WILD"],
  },
});

const CardDeckSchema = new mongoose.Schema({
  name: String,
  description: String,
  cards: [CardSchema],
});

// export const Card = mongoose.model("Card", CardSchema);
export const CardDeck = mongoose.model("CardDeck", CardDeckSchema);
