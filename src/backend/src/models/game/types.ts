import mongoose from "mongoose";
import { CardColor, ICard } from "../card";
import { HouseRule, IHouseRuleConfig } from "../houseRule";

export interface IPlayer {
  user: mongoose.Types.ObjectId;
  hand: mongoose.Types.ObjectId[];
  announcingLastCard: boolean;
  accusable: boolean;
}

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
  unplayableCard = "unplayableCard",
}

export interface IGamePrompt {
  type: GamePromptType;
  data?: number;
  player?: number;
}

export interface IGame {
  currentPlayer: number;
  promptQueue: IGamePrompt[];
  clockwiseTurns: boolean;
  forcedColor?: CardColor;
  notifications: IGameServerMessage[];
  turnsToSkip: number;
  houseRules: IHouseRuleConfig;
  players: IPlayer[];
  discardPile: mongoose.Types.ObjectId[];
  drawPile: mongoose.Types.ObjectId[];
  winningPlayers: mongoose.Types.ObjectId[];
  finished: boolean;
}

export interface IGameMethods {
  announceLastCard(userId: string): Promise<void>;
  nextPlayerIndex(index: number): number;
  accusePlayer(accuserId: string, accusedId: string): void;
  isCardPlayable(cardId: mongoose.Types.ObjectId): Promise<boolean>;
  isAbleToInterject(cardId: mongoose.Types.ObjectId): Promise<boolean>;
  playCard(
    playerIndex: number,
    index: number,
    triggerEffect?: boolean,
  ): Promise<ICard>;
  requestPlayCard(userId: string, index: number): Promise<void>;
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

export interface IGameMessage {
  action: GameAction;
  data?: string | number | boolean;
}

export interface IGameServerMessage {
  action: GameActionServer;
  data?: any;
  user?: string;
}
