import mongoose from "mongoose";
import { houseRule } from "./houseRule";

export interface IWaitingRoom {
  host: mongoose.Types.ObjectId;
  users: [
    {
      user: mongoose.Types.ObjectId;
      ready: boolean;
    },
  ];
  houseRules: string[];
  deck: mongoose.Types.ObjectId;
}

const WaitingRoomSchema = new mongoose.Schema<IWaitingRoom>({
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  users: [
    {
      ready: {
        type: Boolean,
        default: false,
      },
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
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
