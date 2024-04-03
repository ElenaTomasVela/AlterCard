import mongoose from "mongoose";
import { houseRule } from "./houseRule";

const WaitingRoomSchema = new mongoose.Schema({
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  users: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  houseRules: {
    type: [String],
    enum: Object.values(houseRule),
    validate: {
      validator: (arr: string[]) => new Set(arr).size == arr.length,
    },
    message: (props: mongoose.ValidatorProps) =>
      `${props.value} has duplicate values`,
  },
  deck: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CardDeck",
  },
});

export const WaitingRoom = mongoose.model("WaitingRoom", WaitingRoomSchema);
