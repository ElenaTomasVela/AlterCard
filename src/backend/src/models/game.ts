import mongoose from "mongoose";
import { houseRule } from "./houseRule";
import { IWaitingRoom } from "./waitingRoom";
import { Card, CardColor, CardDeck, CardSymbol, ICard } from "./card";
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
  accuse = "accuse",
  answerPrompt = "answerPrompt",
  playCard = "playCard",
  drawCard = "drawCard",
  viewHand = "viewHand",
}

export enum GameActionServer {
  draw = "draw",
  lastCard = "lastCard",
  accuse = "accuse",
  startTurn = "startTurn",
  error = "error",
  changeColor = "changeColor",
  playCard = "playCard",
  viewHand = "viewHand",
  endGame = "endGame",
  requestPrompt = "requestPrompt",
}

export enum GamePromptType {
  chooseColor = "chooseColor",
  stackDrawCard = "stackDrawCard",
  playDrawnCard = "playDrawnCard",
}

export enum GameError {
  notPrompted = "notPrompted",
  invalidAction = "invalidAction",
  outOfTurn = "outOfTurn",
  conditionsNotMet = "conditionsNotMet",
  waitingForPrompt = "waitingForPrompt",
  gameFinished = "gameFinished",
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
  data?: string | number | boolean;
}

export interface IGameServerMessage {
  action: GameActionServer;
  data?: any;
  user?: string;
}

export interface IGame {
  currentPlayer: number;
  promptQueue: IGamePrompt[];
  clockwiseTurns: boolean;
  forcedColor?: CardColor;
  notifications: IGameServerMessage[];
  houseRules: houseRule[];
  players: IPlayer[];
  discardPile: mongoose.Types.ObjectId[];
  drawPile: mongoose.Types.ObjectId[];
  winningPlayers: mongoose.Types.ObjectId[];
  finished: boolean;
}

interface IGameMethods {
  announceLastCard(userId: string): Promise<void>;
  isCardPlayable(cardId: mongoose.Types.ObjectId): Promise<boolean>;
  playCard(playerIndex: number, index: number): Promise<ICard>;
  requestPlayCard(userId: string, index: number): Promise<ICard>;
  canAnnounceLastCard(userId: string): Promise<boolean>;
  nextTurn(): Promise<void>;
  drawCard(playerIndex: number, quantity: number): void;
  handlePlayerPrompt(
    userId: string,
    answer?: string | number | CardColor | boolean,
  ): Promise<void>;
  requestCardDraw(userId: string): void;
  handleCardEffect(cardId: mongoose.Types.ObjectId): Promise<void>;
  pushNotification(notification: IGameServerMessage): void;
}

type GameModel = mongoose.Model<IGame, {}, IGameMethods>;

const GameSchema = new mongoose.Schema<IGame, GameModel, IGameMethods>(
  {
    currentPlayer: {
      type: Number,
      default: 0,
    },
    promptQueue: {
      type: [GamePromptSchema],
      default: [],
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
    forcedColor: {
      type: String,
      enum: Object.values(CardColor),
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
    winningPlayers: [
      { type: mongoose.Schema.Types.ObjectId, ref: "User", default: [] },
    ],
    finished: {
      type: Boolean,
      default: false,
    },
  },
  {
    methods: {
      pushNotification(notification) {
        if (this.notifications == undefined) this.notifications = [];
        this.notifications.push(notification);
      },
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
        if (this.forcedColor) return card.color == this.forcedColor;

        const discardId = this.discardPile[this.discardPile.length - 1];
        const discard = await Card.findById(discardId);

        return card.color == discard!.color || card.symbol == discard!.symbol;
      },

      async requestPlayCard(userId, index) {
        const playerIndex = this.players.findIndex((p) =>
          p.user.equals(new mongoose.Types.ObjectId(userId)),
        );
        if (playerIndex !== this.currentPlayer)
          throw new Error(GameError.outOfTurn);

        const player = this.players[playerIndex];

        const cardId = player?.hand[index];
        if (!cardId) {
          throw new Error(GameError.invalidAction);
        }
        if (!(await this.isCardPlayable(cardId)))
          throw new Error(GameError.conditionsNotMet);

        const playedCard = await this.playCard(playerIndex, index);
        if (this.promptQueue.length == 0) {
          await this.nextTurn();
          this.pushNotification({
            action: GameActionServer.startTurn,
            data: this.currentPlayer,
          });
        }
        return playedCard!;
      },

      async playCard(playerIndex, index) {
        const player = this.players[playerIndex];

        const card = player.hand.splice(index, 1)[0];
        this.discardPile.push(card);

        const dbCard = await Card.findById(card).lean();
        this.pushNotification({
          action: GameActionServer.playCard,
          data: dbCard,
          user: player.user.toString(),
        });
        await this.handleCardEffect(card);

        if (player.hand.length == 0) this.winningPlayers.push(player.user);

        return dbCard!;
      },

      drawCard(playerIndex, quantity = 1) {
        const player = this.players[playerIndex];
        for (let i = 0; i < quantity; i++) {
          // Restock deck if empty
          if (this.drawPile.length == 0) {
            const newCards = this.discardPile.splice(
              0,
              this.discardPile.length - 1,
            );
            shuffle(newCards);
            this.drawPile.push(...newCards);
          }

          const card = this.drawPile.pop();
          player!.hand.push(card!);
        }
      },

      async nextTurn() {
        const orientation = this.clockwiseTurns ? 1 : -1;
        do {
          this.currentPlayer =
            (this.currentPlayer + orientation + this.players.length) %
            this.players.length;
          // Skip players that already won
        } while (this.players[this.currentPlayer].hand.length == 0);

        // finish game
        if (this.winningPlayers.length == this.players.length - 1) {
          this.finished = true;
          this.winningPlayers.push(this.players[this.currentPlayer].user);
        }
      },

      async handlePlayerPrompt(userId, answer) {
        const playerIndex = this.players.findIndex((p) =>
          p.user.equals(new mongoose.Types.ObjectId(userId)),
        );

        const prompt = this.promptQueue[this.promptQueue.length - 1];
        if (!prompt) throw new Error(GameError.notPrompted);

        if (playerIndex !== prompt.player) throw new Error(GameError.outOfTurn);

        const player = this.players[playerIndex];

        switch (prompt.type) {
          case GamePromptType.chooseColor:
            if (
              !answer ||
              typeof answer !== "string" ||
              !Object.values(CardColor).includes(answer as CardColor)
            )
              throw new Error(GameError.invalidAction);
            this.forcedColor = answer as CardColor;
            this.pushNotification({
              action: GameActionServer.changeColor,
              data: answer,
            });
            break;
          case GamePromptType.stackDrawCard:
            break;
          case GamePromptType.playDrawnCard:
            const cardId = player.hand[player.hand.length - 1];
            if ((await this.isCardPlayable(cardId)) && answer) {
              this.playCard(playerIndex, player.hand.length - 1);

              this.pushNotification({
                action: GameActionServer.playCard,
                data: await Card.findById(cardId).lean(),
                user: player.user.toString(),
              });
            }
            break;
        }

        this.promptQueue.pop();

        const shouldSkipTurn = this.promptQueue.length == 0;
        if (shouldSkipTurn) {
          this.nextTurn();
          this.pushNotification({
            action: GameActionServer.startTurn,
            data: this.currentPlayer,
          });
        }
      },
      requestCardDraw(userId) {
        const playerIndex = this.players.findIndex((p) =>
          p.user.equals(new mongoose.Types.ObjectId(userId)),
        );
        if (playerIndex !== this.currentPlayer)
          throw new Error(GameError.outOfTurn);

        if (this.promptQueue.length > 0)
          throw new Error(GameError.waitingForPrompt);

        this.drawCard(playerIndex, 1);

        this.promptQueue.unshift({
          type: GamePromptType.playDrawnCard,
          player: playerIndex,
        });
      },
      async handleCardEffect(cardId) {
        const card = await Card.findById(cardId);
        if (!card) return;
        if (card.color == CardColor.wild) {
          this.promptQueue.unshift({
            type: GamePromptType.chooseColor,
            player: this.currentPlayer,
          });
          this.pushNotification({
            action: GameActionServer.requestPrompt,
            user: this.players[this.currentPlayer].user.toString(),
            data: GamePromptType.chooseColor,
          });
        }

        switch (card.symbol) {
          case CardSymbol.draw2:
            break;
          case CardSymbol.draw4:
            break;
          case CardSymbol.skipTurn:
            break;
          case CardSymbol.reverseTurn:
            break;
          case CardSymbol.changeColor:
            break;
        }
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
