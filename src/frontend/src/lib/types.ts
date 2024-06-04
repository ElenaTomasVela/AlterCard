import { z } from "zod";

const requiredString = (req?: string) => {
  return z
    .string()
    .trim()
    .min(1, { message: req || "This field is required" });
};

export const UserSchema = z.object({
  username: requiredString().max(50, {
    message: "Username cannot exceed 50 characters",
  }),
  password: requiredString().max(100, {
    message: "Password cannot exceed 100 characters",
  }),
});

export type User = z.infer<typeof UserSchema>;

export enum CardColor {
  red = "RED",
  green = "GREEN",
  blue = "BLUE",
  yellow = "YELLOW",
  wild = "WILD",
}

export enum CardSymbol {
  zero = "ZERO",
  one = "ONE",
  two = "TWO",
  three = "THREE",
  four = "FOUR",
  five = "FIVE",
  six = "SIX",
  seven = "SEVEN",
  eight = "EIGHT",
  nine = "NINE",
  draw2 = "DRAW_2",
  draw4 = "DRAW_4",
  skipTurn = "SKIP_TURN",
  reverseTurn = "REVERSE_TURN",
  changeColor = "CHANGE_COLOR",
}

export interface ICard {
  symbol: CardSymbol;
  color: CardColor;
}

export enum HouseRule {
  interjections = "INTERJECTIONS",
}

export enum DrawHouseRule {
  punishmentDraw = "PUNISHMENT_DRAW",
  drawUntilPlay = "DRAW_UNTIL_PLAY",
}

export enum StackDrawHouseRule {
  all = "ALL",
  flat = "FLAT",
  progressive = "PROGRESSIVE",
}

export enum EndConditionHouseRule {
  lastManStanding = "LAST_MAN_STANDING",
  scoreAfterFirstWin = "SCORE_AFTER_FIRST_WIN",
  scoreAfterFirstWinMercy = "SCORE_AFTER_FIRST_WIN_MERCY",
}

export const HouseRuleName = {
  [HouseRule.interjections]: "Jump-in",
  [DrawHouseRule.punishmentDraw]: "Extra card",
  [DrawHouseRule.drawUntilPlay]: "Draw until play",
  [StackDrawHouseRule.progressive]: "Progressive",
  [StackDrawHouseRule.all]: "All",
  [StackDrawHouseRule.flat]: "Flat",
  [EndConditionHouseRule.lastManStanding]: "One player left",
  [EndConditionHouseRule.scoreAfterFirstWin]: "Score",
  [EndConditionHouseRule.scoreAfterFirstWinMercy]: "Score, mercy",
};

export const HouseRuleDetails = {
  [HouseRule.interjections]: {
    id: HouseRule.interjections,
    name: "Jump-in",
    description:
      "If you have a card that matches the discard pile's card in color " +
      "and symbol, you may play it out of turn.\nThis rule does not apply to Wild cards.",
  },
};

export interface IHouseRuleConfig {
  draw?: DrawHouseRule;
  drawCardStacking?: StackDrawHouseRule;
  endCondition: EndConditionHouseRule;
  generalRules: HouseRule[];
}

export interface IWaitingRoom {
  host: {
    username: string;
  };
  users: {
    user: { username: string };
    ready: boolean;
  }[];
  houseRules: IHouseRuleConfig;
  deck: string;
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

export interface IWaitingRoomMessage {
  action: WaitingRoomAction;
  data?: string | boolean;
}

export interface IWaitingRoomServerMessage {
  action: WaitingRoomServerAction;
  data?: string | boolean;
  user?: string;
}

export interface ICardDeck {
  _id: string;
  name: string;
  description: string;
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
}

export interface IGamePrompt {
  type: GamePromptType;
  player?: number;
  data?: number;
}

export interface IGameMessage {
  action: GameAction;
  data?: string | number | boolean;
}

export interface IGameServerMessage {
  action: GameActionServer;
  data?: string | number | ICard | ICard[] | string[] | IGamePrompt;
  user?: string;
}

export interface IPlayer {
  user: {
    _id: string;
    username: string;
  };
  hand:
    | ICard[]
    | {
        length: number;
      };
  announcingLastCard: boolean;
}

export interface IGame {
  _id: string;
  currentPlayer: number;
  promptQueue: IGamePrompt[];
  clockwiseTurns: boolean;
  houseRules: IHouseRuleConfig;
  players: IPlayer[];
  discardPile: ICard[];
  drawPile: { length: number };
  eliminatedPlayers: number[];
  finished: boolean;
  forcedColor?: CardColor;
}
