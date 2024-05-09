import mongoose from "mongoose";
import { houseRule } from "./houseRule";
import { IWaitingRoom } from "./waitingRoom";
import { CardDeck, ICard } from "./card";
import { NotFoundError } from "elysia";
import { dealCards, getFirstNonWild, shuffle } from "../libs/utils";

export interface IPlayer {
  user: mongoose.Types.ObjectId;
  hand: mongoose.Types.ObjectId[];
}

const PlayerSchema = new mongoose.Schema<IPlayer>({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  hand: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Card",
      default: [],
    },
  ],
});

const GameSchema = new mongoose.Schema({
  currentPlayer: {
    type: Number,
    default: 0,
  },
  clockwiseTurns: {
    type: Boolean,
    default: true,
  },
  houseRules: {
    type: [String],
    default: [],
    enum: Object.values(houseRule),
    validate: {
      validator: (arr: string[]) => new Set(arr).size == arr.length,
    },
    message: (props: mongoose.ValidatorProps) =>
      `${props.value} has duplicate values`,
  },
  players: {
    type: [PlayerSchema],
    validate: {
      validator: (v: Array<any>) => v.length >= 2 && v.length <= 30,
      message: (props: mongoose.ValidatorProps) =>
        `Player count should be between 2 and 30, is ${props.value.length}`,
    },
  },
  discardPile: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Card",
      default: [],
    },
  ],
  drawPile: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Card",
      default: [],
    },
  ],
});

export enum GameAction {
  draw = "DRAW",
  play = "PLAY",
  lastCard = "LAST_CARD",
  accuse = "ACCUSE",
  chooseColor = "CHOOSE_COLOR",
}

export const Game = mongoose.model("Game", GameSchema);

export const gameFromWaitingRoom = async (waitingRoom: IWaitingRoom) => {
  const deck = await CardDeck.findById(waitingRoom.deck);
  if (!deck) throw new NotFoundError("Deck not found");

  const cards = deck.cards;
  const players = waitingRoom.users.map(
    (u) => <IPlayer>{ user: u.user, hand: [] },
  );

  // Using mutating methods for simplicity
  shuffle(cards);
  dealCards(players, cards);
  const discardPile = getFirstNonWild(cards);

  const game = new Game({
    players: players,
    houseRules: waitingRoom.houseRules,
    discardPile: [discardPile],
    drawPile: cards,
  });

  game.save();
  return game;
};
