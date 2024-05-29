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
  accusable: boolean;
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
  accusable: {
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
  data?: number;
  player?: number;
}

const GamePromptSchema = new mongoose.Schema<IGamePrompt>({
  type: {
    type: String,
    enum: Object.values(GamePromptType),
  },
  player: Number,
  data: Number,
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
  turnsToSkip: number;
  houseRules: houseRule[];
  players: IPlayer[];
  discardPile: mongoose.Types.ObjectId[];
  drawPile: mongoose.Types.ObjectId[];
  winningPlayers: mongoose.Types.ObjectId[];
  finished: boolean;
}

interface IGameMethods {
  announceLastCard(userId: string): Promise<void>;
  nextPlayerIndex(index: number): number;
  accusePlayer(accuserId: string, accusedId: string): void;
  isCardPlayable(cardId: mongoose.Types.ObjectId): Promise<boolean>;
  playCard(playerIndex: number, index: number): Promise<ICard>;
  requestPlayCard(userId: string, index: number): Promise<ICard>;
  canAnnounceLastCard(userId: string): Promise<boolean>;
  nextTurn(): void;
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
      nextPlayerIndex(index: number) {
        let counter = index;
        const orientation = this.clockwiseTurns ? 1 : -1;
        do {
          counter =
            (counter + orientation + this.players.length) % this.players.length;
          // Skip players that already won
        } while (this.players[counter].hand.length == 0);
        return counter;
      },
      pushNotification(notification) {
        if (this.notifications == undefined) this.notifications = [];
        this.notifications.push(notification);
      },
      async canAnnounceLastCard(userId) {
        const playerIndex = this.players.findIndex(
          (p) => p.user.toString() == userId,
        );
        const player = this.players[playerIndex];

        return (
          player &&
          !player.announcingLastCard &&
          player.hand.length == 2 &&
          this.currentPlayer === playerIndex &&
          player.hand.some((c) => this.isCardPlayable(c))
        );
      },

      async announceLastCard(userId) {
        if (!(await this.canAnnounceLastCard(userId)))
          throw new Error(GameError.conditionsNotMet);
        const player = this.players.find((p) => p.user.toString() == userId);
        player!.announcingLastCard = true;
        this.pushNotification({
          action: GameActionServer.lastCard,
          data: true,
          user: userId,
        });
      },

      accusePlayer(accuserId, accusedId) {
        const accusedIndex = this.players.findIndex(
          (p) => p.user.toString() == accusedId,
        );
        const accused = this.players[accusedIndex];
        if (!accused) throw new Error(GameError.invalidAction);
        if (!accused.accusable) throw new Error(GameError.conditionsNotMet);

        accused.accusable = false;
        this.pushNotification({
          action: GameActionServer.accuse,
          data: accusedId,
          user: accuserId,
        });
        this.drawCard(accusedIndex, 2);
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
          this.nextTurn();
        } else {
          const newPrompt = this.promptQueue[0];
          this.pushNotification({
            action: GameActionServer.requestPrompt,
            data: newPrompt,
            user: this.players[newPrompt.player!].user._id.toString(),
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
        if (this.forcedColor) {
          this.forcedColor = undefined;
          this.pushNotification({ action: GameActionServer.changeColor });
        }

        if (player.hand.length == 0) this.winningPlayers.push(player.user);

        return dbCard!;
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

        const newPrompt = {
          type: GamePromptType.playDrawnCard,
          player: playerIndex,
        };
        this.promptQueue.push(newPrompt);
        this.pushNotification({
          action: GameActionServer.requestPrompt,
          data: newPrompt,
          user: this.players[playerIndex].user.toString(),
        });
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
        this.pushNotification({
          action: GameActionServer.draw,
          data: quantity,
          user: player.user.toString(),
        });
        if (player.announcingLastCard) {
          player.announcingLastCard = false;
          this.pushNotification({
            action: GameActionServer.lastCard,
            data: false,
            user: player.user.toString(),
          });
        }
      },

      nextTurn() {
        // End of turn resolve
        this.players
          .filter((p) => p.accusable)
          .forEach((p) => (p.accusable = false));
        if (
          this.players[this.currentPlayer].hand.length == 1 &&
          !this.players[this.currentPlayer].announcingLastCard
        )
          this.players[this.currentPlayer].accusable = true;

        // Change turn
        for (let n = 0; n < (this.turnsToSkip + 1 || 1); n++) {
          this.currentPlayer = this.nextPlayerIndex(this.currentPlayer);
        }

        this.pushNotification({
          action: GameActionServer.startTurn,
          data: this.currentPlayer,
        });

        if (this.promptQueue.length !== 0) {
          const prompt = this.promptQueue[0];
          this.pushNotification({
            action: GameActionServer.requestPrompt,
            data: prompt,
            user: this.players[prompt.player!].user._id.toString(),
          });
        }

        // Finish game
        if (this.winningPlayers.length == this.players.length - 1) {
          this.finished = true;
          this.winningPlayers.push(this.players[this.currentPlayer].user);
        }
      },

      async handlePlayerPrompt(userId, answer) {
        const playerIndex = this.players.findIndex((p) =>
          p.user.equals(new mongoose.Types.ObjectId(userId)),
        );

        const promptIndex = 0;
        const prompt = this.promptQueue[promptIndex];
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
            if (answer == null || typeof answer !== "number") {
              this.drawCard(prompt.player, prompt.data!);
            } else {
              const cardId = this.players[prompt.player].hand[answer];
              if (!(await this.isCardPlayable(cardId)))
                throw new Error(GameError.conditionsNotMet);
              const card = await Card.findById(cardId);
              const cardsToDraw =
                card!.symbol == CardSymbol.draw2 ? 2 : CardSymbol.draw4 ? 4 : 0;
              // Replace prompt with new prompt for next player
              this.promptQueue.splice(promptIndex + 1, 0, {
                type: GamePromptType.stackDrawCard,
                data: cardsToDraw + prompt.data!,
                player: this.nextPlayerIndex(prompt.player),
              });

              const chooseColorPrompt = this.promptQueue.find(
                (p) => p.type == GamePromptType.chooseColor,
              );
              if (chooseColorPrompt) {
                chooseColorPrompt.player = prompt.player;
              }
            }

            break;
          case GamePromptType.playDrawnCard:
            const cardId = player.hand[player.hand.length - 1];
            if ((await this.isCardPlayable(cardId)) && answer) {
              await this.playCard(playerIndex, player.hand.length - 1);
            }
            break;
        }

        this.promptQueue.shift();

        const shouldSkipTurn = this.promptQueue.length == 0;
        if (shouldSkipTurn) {
          this.nextTurn();
        } else {
          const newPrompt = this.promptQueue[0];
          this.pushNotification({
            action: GameActionServer.requestPrompt,
            data: newPrompt,
            user: this.players[newPrompt.player!].user._id.toString(),
          });
        }
      },
      async handleCardEffect(cardId) {
        const card = await Card.findById(cardId);
        if (!card) return;
        switch (card.symbol) {
          case CardSymbol.draw2:
            this.promptQueue.push({
              type: GamePromptType.stackDrawCard,
              data: 2,
              player: this.nextPlayerIndex(this.currentPlayer),
            });
            break;
          case CardSymbol.draw4:
            this.promptQueue.push({
              type: GamePromptType.stackDrawCard,
              data: 4,
              player: this.nextPlayerIndex(this.currentPlayer),
            });
            break;
          case CardSymbol.skipTurn:
            this.turnsToSkip = 1;
            break;
          case CardSymbol.reverseTurn:
            this.clockwiseTurns = !this.clockwiseTurns;
            break;
          case CardSymbol.changeColor:
            break;
          default:
            break;
        }
        if (card.color == CardColor.wild) {
          this.promptQueue.push({
            type: GamePromptType.chooseColor,
            player: this.currentPlayer,
          });
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
    (u) =>
      <IPlayer>{
        user: u.user,
        hand: [],
        announcingLastCard: false,
        accusable: false,
      },
  );

  // Using mutating methods for simplicity
  shuffle(cards);
  dealCards(players, cards);
  const discardPile = await getFirstNonWild(cards);

  const game = new Game({
    players: players,
    houseRules: waitingRoom.houseRules,
    discardPile: [discardPile],
    drawPile: cards,
  });

  await game.save();
  return game;
};
