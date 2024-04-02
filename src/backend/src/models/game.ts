import mongoose from "mongoose";
import { houseRule } from "./houseRule";

const PlayerSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  hand: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Card",
    },
  ],
});

const GameSchema = new mongoose.Schema({
  currentPlayer: Number,
  clockwiseTurns: Boolean,
  houseRules: {
    type: [String],
    enum: Object.values(houseRule),
    validate: {
      validator: (arr: string[]) => new Set(arr).size == arr.length,
    },
    message: (props: mongoose.ValidatorProps) =>
      `${props.value} has duplicate values`,
  },
  players: [PlayerSchema],
  discardPile: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Card",
    },
  ],
  drawPile: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Card",
    },
  ],
});

export const Game = mongoose.model("Game", GameSchema);
