import mongoose from "mongoose";
import {
  HouseRuleConfigSchema,
  IHouseRuleConfig,
  tHouseRuleConfig,
} from "./houseRule";
import { t } from "elysia";

export interface IWaitingRoom {
  host: mongoose.Types.ObjectId;
  users: {
    user: mongoose.Types.ObjectId;
    ready: boolean;
  }[];
  houseRules: IHouseRuleConfig;
  deck: mongoose.Types.ObjectId;
}

export enum WaitingRoomAction {
  start = "start",
  addRule = "addRule",
  removeRule = "removeRule",
  ready = "ready",
  setDeck = "setDeck",
  setRule = "setRule",
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
  setDeck = "setDeck",
  setRule = "setRule",
}

export enum WaitingRoomError {
  notTheHost = "notTheHost",
  notEnoughPlayers = "notEnoughPlayers",
  notReady = "notReady",
  noDeck = "noDeck",
}

export interface IWaitingRoomMessage {
  action: WaitingRoomAction;
  data?: string | boolean | IHouseRuleConfig;
}

export interface IWaitingRoomServerMessage {
  action: WaitingRoomServerAction;
  data?: string | boolean | IHouseRuleConfig;
  user?: string;
}

export const tWaitingRoomMessage = t.Object({
  action: t.Enum(WaitingRoomAction),
  data: t.Optional(t.Union([t.String(), t.Boolean(), tHouseRuleConfig])),
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
    type: HouseRuleConfigSchema,
    default: {
      generalRules: [],
    },
  },
  deck: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CardDeck",
  },
});

export const WaitingRoom = mongoose.model("WaitingRoom", WaitingRoomSchema);
