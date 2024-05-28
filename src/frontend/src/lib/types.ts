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
  stackDraw = "STACK_DRAW",
  punishmentDraw = "PUNISHMENT_DRAW",
  interjections = "INTERJECTIONS",
  restrictedDraw4 = "RESTRICTED_DRAW_4",
}

export const HouseRuleDetails = [
  {
    name: "Stackable Draw Cards",
    description:
      "When a player plays a Draw X card, the next player may respond with a Draw Y card, " +
      "where Y must be greater than or equal to X. \n\nThe next player must draw the added amount or" +
      "play another Draw Z card, where Z must be greater than or equal to Y.",
    id: HouseRule.stackDraw,
  },
  {
    name: "Punishment Draw",
    description:
      "When a player, in their turn, draws a card and chooses not to play it, they must draw another card.",
    id: HouseRule.punishmentDraw,
  },
  {
    name: "Allow Interjections",
    description:
      "When a player has a card that matches the discard pile's card in both color and symbol, it may be played " +
      "even outside of the player's turn.\n\n This rule does not apply to Wild Cards.",
    id: HouseRule.interjections,
  },
  {
    name: "Restricted Draw 4",
    description:
      "A player may not play a Draw 4 card unless it's their only playable card.\n" +
      "If another player suspects that this rule was violated, they may accuse the card player.\n\n" +
      "If their accusation is correct, the cards to draw go to the accused. Otherwise, the accuser must " +
      "draw that number of cards + 2.",
    id: HouseRule.restrictedDraw4,
  },
];

export interface IWaitingRoom {
  host: {
    username: string;
  };
  users: {
    user: { username: string };
    ready: boolean;
  }[];
  houseRules: HouseRule[];
  deck: string;
}

export enum WaitingRoomAction {
  start = "start",
  addRule = "addRule",
  removeRule = "removeRule",
  ready = "ready",
  setDeck = "setDeck",
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
}

export interface IGameMessage {
  action: GameAction;
  data?: string | number | boolean;
}

export interface IGameServerMessage {
  action: GameActionServer;
  data?: string | number | ICard | ICard[] | string[];
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
  currentPlayer: number;
  promptQueue: IGamePrompt[];
  clockwiseTurns: boolean;
  houseRules: HouseRule[];
  players: IPlayer[];
  discardPile: ICard[];
  drawPile: { length: number };
  winningPlayers: string[];
  finished: boolean;
  forcedColor?: CardColor;
}
