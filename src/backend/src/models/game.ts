import mongoose from "mongoose";
import { houseRule } from "./houseRule";
import { IWaitingRoom } from "./waitingRoom";
import { Card, CardColor, CardDeck, ICard } from "./card";
import { NotFoundError, t } from "elysia";
import {
  dealCards,
  getFirstNonWild,
  moveFromStack,
  shuffle,
} from "../libs/utils";

export interface IPlayer {
  user: mongoose.Types.ObjectId;
  hand: mongoose.Types.ObjectId[];
  announcingLastCard: boolean;
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
  announcingLastCard: {
    type: Boolean,
    default: false,
  },
});

export enum GameAction {
  lastCard = "lastCard",
  pass = "pass",
  accuse = "accuse",
  answerPrompt = "answerPrompt",
  playCard = "playCard",
}

export enum GameActionServer {
  draw = "draw",
  lastCard = "lastCard",
  accuse = "accuse",
  startTurn = "startTurn",
  endTurn = "endTurn",
  error = "error",
  changeColor = "changeColor",
  playCard = "playCard",
}

export enum GamePromptType {
  playCard = "playCard",
  chooseColor = "chooseColor",
  stackDrawCard = "stackDrawCard",
}

export enum GameError {
  notPrompted = "notPrompted",
  invalidAction = "invalidAction",
  wrongPlayer = "wrongPlayer",
  conditionsNotMet = "conditionsNotMet",
}

export interface IGamePrompt {
  type: GamePromptType;
  player?: number;
}

const GamePromptSchema = new mongoose.Schema<IGamePrompt>({
  type: {
    type: String,
    enum: Object.values(GamePromptType),
  },
  player: Number,
});

export interface IGameMessage {
  action: GameAction;
  data?: string | number;
}

export interface IGameServerMessage {
  action: GameActionServer;
  data?: any;
  user?: string;
}

export interface IGame {
  currentPlayer: number;
  currentPrompt?: IGamePrompt | null;
  clockwiseTurns: boolean;
  houseRules: houseRule[];
  players: IPlayer[];
  discardPile: mongoose.Types.ObjectId[];
  drawPile: mongoose.Types.ObjectId[];
}

interface IGameMethods {
  announceLastCard(userId: string): Promise<void>;
  isCardPlayable(cardId: mongoose.Types.ObjectId): Promise<boolean>;
  playCard(userId: string, index: number): Promise<ICard>;
  canAnnounceLastCard(userId: string): Promise<boolean>;
  nextTurn(): Promise<void>;
}

type GameModel = mongoose.Model<IGame, {}, IGameMethods>;

const GameSchema = new mongoose.Schema<IGame, GameModel, IGameMethods>(
  {
    currentPlayer: {
      type: Number,
      default: 0,
    },
    currentPrompt: GamePromptSchema,
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
  },
  {
    methods: {
      async canAnnounceLastCard(userId) {
        const playerIndex = this.players.findIndex(
          (p) => p.user == new mongoose.Types.ObjectId(userId),
        );
        const player = this.players[playerIndex];

        return (
          !player.announcingLastCard &&
          player.hand.length == 2 &&
          this.currentPlayer === playerIndex &&
          player.hand.some((c) => this.isCardPlayable(c))
        );
      },
      async announceLastCard(userId) {
        if (!this.canAnnounceLastCard(userId))
          throw new Error(GameError.conditionsNotMet);
        const player = this.players.find(
          (p) => p.user == new mongoose.Types.ObjectId(userId),
        );
        player!.announcingLastCard = true;
      },
      async isCardPlayable(cardId) {
        const card = await Card.findById(cardId);
        if (!card) throw new Error(GameError.invalidAction);

        if (card.color == CardColor.wild) return true;

        const discardId = this.discardPile[this.discardPile.length - 1];
        const discard = await Card.findById(discardId);

        return card.color == discard!.color || card.symbol == discard!.symbol;
      },
      async playCard(userId, index) {
        const player = this.players.find((p) =>
          p.user.equals(new mongoose.Types.ObjectId(userId)),
        );
        const cardId = player?.hand[index];
        if (!cardId) throw new Error(GameError.invalidAction);
        if (!this.isCardPlayable(cardId))
          throw new Error(GameError.conditionsNotMet);

        const card = player.hand.splice(index, 1)[0];
        this.discardPile.push(card);
        // TODO: Resolve effects
        await this.nextTurn();
        return (await Card.findById(card).lean())!;
      },
      async nextTurn() {
        const orientation = this.clockwiseTurns ? 1 : -1;
        this.currentPlayer =
          (this.currentPlayer + orientation + this.players.length) %
          this.players.length;
      },
    },
  },
);

export const Game = mongoose.model<IGame, GameModel>("Game", GameSchema);

export const gameFromWaitingRoom = async (waitingRoom: IWaitingRoom) => {
  const deck = await CardDeck.findById(waitingRoom.deck);
  if (!deck) throw new NotFoundError("Deck not found");

  const cards = deck.cards;
  const players = waitingRoom.users.map(
    (u) => <IPlayer>{ user: u.user, hand: [], announcingLastCard: false },
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

  await game.save();
  return game;
};
