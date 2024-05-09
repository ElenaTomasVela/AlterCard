import mongoose from "mongoose";
import { houseRule } from "./houseRule";
import { IPopulatedUser } from "./user";
import { t } from "elysia";

export interface IWaitingRoom {
  host: mongoose.Types.ObjectId;
  users: {
    user: mongoose.Types.ObjectId;
    ready: boolean;
  }[];
  houseRules: string[];
  deck: mongoose.Types.ObjectId;
}

export enum WaitingRoomAction {
  start = "start",
  addRule = "addRule",
  removeRule = "removeRule",
  ready = "ready",
}

export enum WaitingRoomServerAction {
  start = "start",
  addRule = "addRule",
  removeRule = "removeRule",
  ready = "ready",
  playerJoined = "playerJoined",
  playerLeft = "playerLeft",
  newHost = "newHost",
  error = "error",
}

export enum WaitingRoomError {
  notTheHost = "notTheHost",
  notEnoughPlayers = "notEnoughPlayers",
  notReady = "notReady",
}

export interface IWaitingRoomMessage {
  action: WaitingRoomAction;
  data?: string | boolean;
  user?: string;
}

export interface IWaitingRoomServerMessage {
  action: WaitingRoomServerAction;
  data?: string | boolean;
  user?: string;
}

export const tWaitingRoomMessage = t.Object({
  action: t.Enum(WaitingRoomAction),
  data: t.Optional(t.Union([t.String(), t.Boolean()])),
  player: t.Optional(t.String()),
});

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
