import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import mongoose from "mongoose";
import { Game, gameFromWaitingRoom } from "../src/models/game/schema";
import {
  GameAction,
  GameActionServer,
  GameError,
  GamePromptType,
  IGame,
  IGameMessage,
  IGameServerMessage,
} from "../src/models/game/types";
import {
  Card,
  CardColor,
  CardDeck,
  CardSymbol,
  ICard,
} from "../src/models/card";
import { User } from "../src/models/user";
import { WaitingRoom } from "../src/models/waitingRoom";
import {
  waitForGameAction,
  waitForSocketConnection,
  waitForSocketMessage,
} from "./utils";
import { token1, token2, token3, users } from "./setup";
import { HouseRule, StackDrawHouseRule } from "../src/models/houseRule";

let game: mongoose.Document & IGame;

let session1: WebSocket;
let session2: WebSocket;
let session3: WebSocket;
beforeEach(async () => {
  WaitingRoom.deleteMany({});
  Game.deleteMany({});

  const dbUsers = await User.find();
  const deck = await CardDeck.findOne();

  const waitingRoom = new WaitingRoom({
    host: dbUsers[0]._id,
    users: [
      { user: dbUsers[0]._id },
      { user: dbUsers[1]._id },
      { user: dbUsers[2]._id },
    ],
    deck: deck!._id,
  });
  game = await gameFromWaitingRoom(waitingRoom);

  session1 = new WebSocket(`ws://localhost:3000/game/${game.id}/ws`, {
    // @ts-expect-error
    headers: { Cookie: `authorization=${token1}` },
  });
  await waitForSocketConnection(session1);
  session2 = new WebSocket(`ws://localhost:3000/game/${game.id}/ws`, {
    // @ts-expect-error
    headers: { Cookie: `authorization=${token2}` },
  });
  await waitForSocketConnection(session2);
  session3 = new WebSocket(`ws://localhost:3000/game/${game.id}/ws`, {
    // @ts-expect-error
    headers: { Cookie: `authorization=${token3}` },
  });
  await waitForSocketConnection(session3);
});

describe("Play card", () => {
  test.each([
    [
      { color: CardColor.red, symbol: CardSymbol.zero } as ICard,
      { color: CardColor.red, symbol: CardSymbol.one } as ICard,
    ],
    [
      { color: CardColor.red, symbol: CardSymbol.zero } as ICard,
      { color: CardColor.blue, symbol: CardSymbol.zero } as ICard,
    ],
    [
      { color: CardColor.wild } as ICard,
      { color: CardColor.blue, symbol: CardSymbol.zero } as ICard,
    ],
  ])("Correct play", async (handCard, discardPileCard) => {
    const dbHandCard = await Card.findOne(handCard);
    const dbDiscardCard = await Card.findOne(discardPileCard);
    game.players[0].hand.push(dbHandCard!._id);
    game.discardPile.push(dbDiscardCard!._id);
    await game.save();

    session1.send(
      JSON.stringify({
        action: GameAction.playCard,
        data: 7,
      } as IGameMessage),
    );

    const message = JSON.parse(
      await waitForSocketMessage(session1),
    ) as IGameServerMessage;

    const gameAfter = await Game.findById(game._id);
    expect(message.action).toBe(GameActionServer.playCard);
    expect(gameAfter!.discardPile.length).toBe(game.discardPile.length + 1);
    expect(gameAfter!.players[0].hand.length).toBe(
      game.players[0].hand.length - 1,
    );
  });

  test("Unplayable card", async () => {
    const dbHandCard = await Card.findOne({
      symbol: CardSymbol.one,
      color: CardColor.red,
    });
    const dbDiscardCard = await Card.findOne({
      symbol: CardSymbol.zero,
      color: CardColor.blue,
    });
    game.players[0].hand.push(dbHandCard!._id);
    game.discardPile.push(dbDiscardCard!._id);
    await game.save();

    session1.send(
      JSON.stringify({
        action: GameAction.playCard,
        data: 7,
      } as IGameMessage),
    );

    const message = JSON.parse(
      await waitForSocketMessage(session1),
    ) as IGameServerMessage;
    const gameAfter = await Game.findById(game._id);
    expect(message.action).toBe(GameActionServer.error);
    expect(message.data).toBe(GameError.conditionsNotMet);
    expect(gameAfter!.discardPile.length).toBe(game.discardPile.length);
    expect(gameAfter!.players[0].hand.length).toBe(game.players[0].hand.length);
  });

  test("Out of turn", async () => {
    const dbHandCard = await Card.findOne({
      symbol: CardSymbol.one,
      color: CardColor.red,
    });
    const dbDiscardCard = await Card.findOne({
      symbol: CardSymbol.zero,
      color: CardColor.red,
    });
    game.players[0].hand.push(dbHandCard!._id);
    game.discardPile.push(dbDiscardCard!._id);
    await game.save();

    session2.send(
      JSON.stringify({
        action: GameAction.playCard,
        data: 7,
      } as IGameMessage),
    );

    const message = JSON.parse(
      await waitForSocketMessage(session2),
    ) as IGameServerMessage;
    const gameAfter = await Game.findById(game._id);
    expect(message.action).toBe(GameActionServer.error);
    expect(message.data).toBe(GameError.outOfTurn);
    expect(gameAfter!.discardPile.length).toBe(game.discardPile.length);
    expect(gameAfter!.players[0].hand.length).toBe(game.players[0].hand.length);
  });
});

describe("Draw card", () => {
  test("Correct draw", async () => {
    session1.send(
      JSON.stringify({
        action: GameAction.drawCard,
      } as IGameMessage),
    );

    const message = JSON.parse(
      await waitForSocketMessage(session1),
    ) as IGameServerMessage;
    await waitForSocketMessage(session2);

    const gameAfter = await Game.findById(game._id);
    expect(message.action).toBe(GameActionServer.draw);
    expect(message.data).toBe(1);
    expect(gameAfter!.drawPile.length).toBe(game.drawPile.length - 1);
    expect(gameAfter!.players[0].hand.length).toBe(
      game.players[0].hand.length + 1,
    );
  });
});

describe("Prompts", () => {
  describe("Play drawn card", () => {
    test("Correct play", async () => {
      const dbPlayableCard = await Card.findOne({
        symbol: CardSymbol.one,
        color: CardColor.red,
      });
      const dbDiscardCard = await Card.findOne({
        symbol: CardSymbol.zero,
        color: CardColor.red,
      });
      game.drawPile.push(dbPlayableCard!._id);
      game.discardPile.push(dbDiscardCard!._id);
      await game.save();

      session1.send(
        JSON.stringify({
          action: GameAction.drawCard,
        } as IGameMessage),
      );
      await waitForSocketMessage(session1);
      await waitForSocketMessage(session1);
      session1.send(
        JSON.stringify({
          action: GameAction.answerPrompt,
          data: true,
        } as IGameMessage),
      );

      const message = JSON.parse(
        await waitForSocketMessage(session1),
      ) as IGameServerMessage;
      const gameAfter = await Game.findById(game._id);
      expect(message.action).toBe(GameActionServer.playCard);
      expect(message.data._id).toBe(dbPlayableCard!.id);
      expect(gameAfter!.drawPile.length).toBe(game.drawPile.length - 1);
      expect(gameAfter!.discardPile.length).toBe(game.discardPile.length + 1);
      expect(gameAfter!.players[0].hand.length).toBe(
        game.players[0].hand.length,
      );
    });

    test("Effect card", async () => {
      const dbPlayableCard = await Card.findOne({
        symbol: CardSymbol.changeColor,
        color: CardColor.wild,
      });
      game.drawPile.push(dbPlayableCard!._id);
      await game.save();

      session1.send(
        JSON.stringify({
          action: GameAction.drawCard,
        } as IGameMessage),
      );
      await waitForSocketMessage(session1);
      await waitForSocketMessage(session1);
      session1.send(
        JSON.stringify({
          action: GameAction.answerPrompt,
          data: true,
        } as IGameMessage),
      );

      const message = JSON.parse(
        await waitForSocketMessage(session1),
      ) as IGameServerMessage;
      const promptMessage = JSON.parse(
        await waitForSocketMessage(session1),
      ) as IGameServerMessage;
      const gameAfter = await Game.findById(game._id);
      expect(message.action).toBe(GameActionServer.playCard);
      expect(message.data._id).toBe(dbPlayableCard!.id);
      expect(promptMessage.action).toBe(GameActionServer.requestPrompt);
      expect(promptMessage.data.type).toBe(GamePromptType.chooseColor);
      expect(gameAfter!.drawPile.length).toBe(game.drawPile.length - 1);
      expect(gameAfter!.discardPile.length).toBe(game.discardPile.length + 1);
      expect(gameAfter!.players[0].hand.length).toBe(
        game.players[0].hand.length,
      );
    });

    test("Do not play card", async () => {
      const dbPlayableCard = await Card.findOne({
        symbol: CardSymbol.one,
        color: CardColor.red,
      });
      const dbDiscardCard = await Card.findOne({
        symbol: CardSymbol.zero,
        color: CardColor.red,
      });
      game.drawPile.push(dbPlayableCard!._id);
      game.discardPile.push(dbDiscardCard!._id);
      await game.save();

      session1.send(
        JSON.stringify({
          action: GameAction.drawCard,
        } as IGameMessage),
      );
      await waitForSocketMessage(session1);
      await waitForSocketMessage(session1);
      session1.send(
        JSON.stringify({
          action: GameAction.answerPrompt,
          data: false,
        } as IGameMessage),
      );

      const message = JSON.parse(
        await waitForSocketMessage(session1),
      ) as IGameServerMessage;
      const gameAfter = await Game.findById(game._id);
      expect(message.action).toBe(GameActionServer.startTurn);
      expect(gameAfter!.drawPile.length).toBe(game.drawPile.length - 1);
      expect(gameAfter!.discardPile.length).toBe(game.discardPile.length);
      expect(gameAfter!.players[0].hand.length).toBe(
        game.players[0].hand.length + 1,
      );
    });

    test("Unplayable card", async () => {
      const dbPlayableCard = await Card.findOne({
        symbol: CardSymbol.one,
        color: CardColor.blue,
      });
      const dbDiscardCard = await Card.findOne({
        symbol: CardSymbol.zero,
        color: CardColor.red,
      });
      game.drawPile.push(dbPlayableCard!._id);
      game.discardPile.push(dbDiscardCard!._id);
      await game.save();

      session1.send(
        JSON.stringify({
          action: GameAction.drawCard,
        } as IGameMessage),
      );
      await waitForSocketMessage(session1);
      await waitForSocketMessage(session1);
      session1.send(
        JSON.stringify({
          action: GameAction.answerPrompt,
          data: true,
        } as IGameMessage),
      );

      const message = JSON.parse(
        await waitForSocketMessage(session1),
      ) as IGameServerMessage;
      const gameAfter = await Game.findById(game._id);
      expect(message.action).toBe(GameActionServer.error);
      expect(message.data).toBe(GameError.conditionsNotMet);
      expect(gameAfter!.drawPile.length).toBe(game.drawPile.length - 1);
      expect(gameAfter!.discardPile.length).toBe(game.discardPile.length);
      expect(gameAfter!.players[0].hand.length).toBe(
        game.players[0].hand.length + 1,
      );
      expect(gameAfter!.currentPlayer).toBe(0);
    });
  });

  describe("Change color", () => {
    test("Correct color change", async () => {
      const dbPlayableCard = await Card.findOne({
        symbol: CardSymbol.changeColor,
        color: CardColor.wild,
      });
      game.players[0].hand.unshift(dbPlayableCard!._id);
      await game.save();

      session1.send(
        JSON.stringify({
          action: GameAction.playCard,
          data: 0,
        } as IGameMessage),
      );
      await waitForSocketMessage(session1),
        await waitForSocketMessage(session1),
        session1.send(
          JSON.stringify({
            action: GameAction.answerPrompt,
            data: CardColor.red,
          } as IGameMessage),
        );

      const message = JSON.parse(
        await waitForSocketMessage(session1),
      ) as IGameServerMessage;
      const gameAfter = await Game.findById(game._id);
      expect(message.action).toBe(GameActionServer.changeColor);
      expect(message.data).toBe(CardColor.red);
      expect(gameAfter?.forcedColor).toBe(CardColor.red);
    });

    test("Invalid action", async () => {
      const dbPlayableCard = await Card.findOne({
        symbol: CardSymbol.changeColor,
        color: CardColor.wild,
      });
      game.players[0].hand.unshift(dbPlayableCard!._id);
      await game.save();

      session1.send(
        JSON.stringify({
          action: GameAction.playCard,
          data: 0,
        } as IGameMessage),
      );
      await waitForSocketMessage(session1),
        await waitForSocketMessage(session1),
        session1.send(
          JSON.stringify({
            action: GameAction.answerPrompt,
            data: false,
          } as IGameMessage),
        );

      const message = JSON.parse(
        await waitForSocketMessage(session1),
      ) as IGameServerMessage;
      const gameAfter = await Game.findById(game._id);
      expect(message.action).toBe(GameActionServer.error);
      expect(message.data).toBe(GameError.invalidAction);
      expect(gameAfter?.forcedColor).toBeUndefined();
    });
  });

  describe("Stack draw cards", () => {
    test("Draw 2", async () => {
      const handCard = {
        symbol: CardSymbol.draw2,
        color: CardColor.red,
      } as ICard;
      const discardCard = {
        symbol: CardSymbol.one,
        color: CardColor.red,
      } as ICard;
      const dbHandCard = await Card.findOne(handCard);
      const dbDiscardCard = await Card.findOne(discardCard);
      game.players[0].hand.push(dbHandCard!._id);
      game.players[1].hand.push(dbHandCard!._id);
      game.houseRules.drawCardStacking = StackDrawHouseRule.all;
      game.discardPile.push(dbDiscardCard!._id);
      await game.save();

      session1.send(
        JSON.stringify({
          action: GameAction.playCard,
          data: 7,
        } as IGameMessage),
      );
      await waitForGameAction(session3, GameActionServer.requestPrompt);
      session2.send(
        JSON.stringify({
          action: GameAction.answerPrompt,
          data: game.players[1].hand.length - 1,
        } as IGameMessage),
      );
      await waitForGameAction(session3, GameActionServer.requestPrompt);
      session3.send(
        JSON.stringify({
          action: GameAction.answerPrompt,
          data: false,
        } as IGameMessage),
      );

      const message = JSON.parse(
        await waitForSocketMessage(session3),
      ) as IGameServerMessage;
      const gameAfter = await Game.findById(game._id);
      expect(message.action).toBe(GameActionServer.draw);
      expect(message.data).toBe(4);
      expect(gameAfter?.currentPlayer).toBe(0);
    });

    test("Invalid card", async () => {
      const handCard = {
        symbol: CardSymbol.draw2,
        color: CardColor.red,
      } as ICard;
      const unplayableCard = {
        symbol: CardSymbol.zero,
        color: CardColor.blue,
      } as ICard;
      const discardCard = {
        symbol: CardSymbol.one,
        color: CardColor.red,
      } as ICard;
      const dbHandCard = await Card.findOne(handCard);
      const dbUnplayableCard = await Card.findOne(unplayableCard);
      const dbDiscardCard = await Card.findOne(discardCard);
      game.players[0].hand.push(dbHandCard!._id);
      game.players[1].hand.push(dbUnplayableCard!._id);
      game.houseRules.drawCardStacking = StackDrawHouseRule.all;
      game.discardPile.push(dbDiscardCard!._id);
      await game.save();

      session1.send(
        JSON.stringify({
          action: GameAction.playCard,
          data: 7,
        } as IGameMessage),
      );
      await waitForGameAction(session2, GameActionServer.requestPrompt);
      session2.send(
        JSON.stringify({
          action: GameAction.answerPrompt,
          data: 7,
        } as IGameMessage),
      );

      const message = JSON.parse(
        await waitForSocketMessage(session2),
      ) as IGameServerMessage;
      const gameAfter = await Game.findById(game._id);
      expect(message.action).toBe(GameActionServer.error);
      expect(message.data).toBe(GameError.conditionsNotMet);
      expect(gameAfter?.players[1].hand.length).toBe(
        game.players[1].hand.length,
      );
    });

    test("Wild Draw cards", async () => {
      const handCard = {
        symbol: CardSymbol.draw4,
        color: CardColor.wild,
      } as ICard;
      const dbHandCard = await Card.findOne(handCard);
      game.players[0].hand.push(dbHandCard!._id);
      game.players[1].hand.push(dbHandCard!._id);
      game.houseRules.drawCardStacking = StackDrawHouseRule.all;
      await game.save();

      session1.send(
        JSON.stringify({
          action: GameAction.playCard,
          data: 7,
        } as IGameMessage),
      );
      await waitForGameAction(session2, GameActionServer.requestPrompt);
      session2.send(
        JSON.stringify({
          action: GameAction.answerPrompt,
          data: 7,
        } as IGameMessage),
      );
      await waitForGameAction(session2, GameActionServer.requestPrompt);
      session3.send(
        JSON.stringify({
          action: GameAction.answerPrompt,
          data: false,
        } as IGameMessage),
      );
      await waitForGameAction(session2, GameActionServer.requestPrompt);
      session2.send(
        JSON.stringify({
          action: GameAction.answerPrompt,
          data: CardColor.red,
        } as IGameMessage),
      );

      const message = JSON.parse(
        await waitForSocketMessage(session2),
      ) as IGameServerMessage;
      const gameAfter = await Game.findById(game._id);
      expect(message.action).toBe(GameActionServer.changeColor);
      expect(message.data).toBe(CardColor.red);
      expect(gameAfter?.currentPlayer).toBe(0);
    });

    test("House rule not enabled", async () => {
      const handCard = {
        symbol: CardSymbol.draw2,
        color: CardColor.red,
      } as ICard;
      const discardCard = {
        symbol: CardSymbol.one,
        color: CardColor.red,
      } as ICard;
      const dbHandCard = await Card.findOne(handCard);
      const dbDiscardCard = await Card.findOne(discardCard);
      game.players[0].hand.push(dbHandCard!._id);
      game.players[1].hand.push(dbHandCard!._id);
      game.discardPile.push(dbDiscardCard!._id);
      await game.save();

      session1.send(
        JSON.stringify({
          action: GameAction.playCard,
          data: 7,
        } as IGameMessage),
      );
      await waitForGameAction(session2, GameActionServer.startTurn);
      session2.send(
        JSON.stringify({
          action: GameAction.answerPrompt,
          data: game.players[1].hand.length - 1,
        } as IGameMessage),
      );
      const message = JSON.parse(
        await waitForSocketMessage(session2),
      ) as IGameServerMessage;
      const gameAfter = await Game.findById(game._id);
      expect(message.action).toBe(GameActionServer.error);
      expect(message.data).toBe(GameError.notPrompted);
      expect(gameAfter?.currentPlayer).toBe(2);
    });
  });
});

describe("Card effects", () => {
  test("Skip turn", async () => {
    const handCard = {
      symbol: CardSymbol.skipTurn,
      color: CardColor.red,
    } as ICard;
    const discardCard = {
      symbol: CardSymbol.one,
      color: CardColor.red,
    } as ICard;
    const dbHandCard = await Card.findOne(handCard);
    const dbDiscardCard = await Card.findOne(discardCard);
    game.players[0].hand.push(dbHandCard!._id);
    game.discardPile.push(dbDiscardCard!._id);
    await game.save();

    session1.send(
      JSON.stringify({
        action: GameAction.playCard,
        data: 7,
      } as IGameMessage),
    );

    await waitForSocketMessage(session2);
    const message = JSON.parse(
      await waitForSocketMessage(session2),
    ) as IGameServerMessage;
    const gameAfter = await Game.findById(game._id);
    expect(message.action).toBe(GameActionServer.startTurn);
    expect(message.data).toBe(2);
    expect(gameAfter?.currentPlayer).toBe(2);
  });

  test("Reverse turn order effect", async () => {
    const handCard = {
      symbol: CardSymbol.reverseTurn,
      color: CardColor.red,
    } as ICard;
    const discardCard = {
      symbol: CardSymbol.one,
      color: CardColor.red,
    } as ICard;
    const dbHandCard = await Card.findOne(handCard);
    const dbDiscardCard = await Card.findOne(discardCard);
    game.players[0].hand.push(dbHandCard!._id);
    game.discardPile.push(dbDiscardCard!._id);
    await game.save();

    session1.send(
      JSON.stringify({
        action: GameAction.playCard,
        data: 7,
      } as IGameMessage),
    );

    await waitForSocketMessage(session2);
    const gameAfter = await Game.findById(game._id);
    expect(gameAfter?.clockwiseTurns).toBe(!game.clockwiseTurns);
  });
  test("Reverse turn order skips when 2 players", async () => {
    const handCard = {
      symbol: CardSymbol.reverseTurn,
      color: CardColor.red,
    } as ICard;
    const discardCard = {
      symbol: CardSymbol.one,
      color: CardColor.red,
    } as ICard;
    const dbHandCard = await Card.findOne(handCard);
    const dbDiscardCard = await Card.findOne(discardCard);
    game.players[0].hand.push(dbHandCard!._id);
    game.players.pop();
    game.discardPile.push(dbDiscardCard!._id);
    await game.save();

    const session1 = new WebSocket(`ws://localhost:3000/game/${game.id}/ws`, {
      // @ts-expect-error
      headers: { Cookie: `authorization=${token1}` },
    });
    await waitForSocketConnection(session1);
    const session2 = new WebSocket(`ws://localhost:3000/game/${game.id}/ws`, {
      // @ts-expect-error
      headers: { Cookie: `authorization=${token2}` },
    });
    await waitForSocketConnection(session2);

    session1.send(
      JSON.stringify({
        action: GameAction.playCard,
        data: 7,
      } as IGameMessage),
    );

    await waitForSocketMessage(session2);
    const gameAfter = await Game.findById(game._id);
    expect(gameAfter?.clockwiseTurns).toBe(!game.clockwiseTurns);
    expect(gameAfter?.currentPlayer).toBe(0);
  });
});

describe("Announce last card", () => {
  test("Correct announcement", async () => {
    const dbPlayableCard = await Card.findOne({
      symbol: CardSymbol.changeColor,
      color: CardColor.wild,
    });
    game.players[0].hand = [dbPlayableCard!._id, dbPlayableCard!._id];
    await game.save();

    session1.send(
      JSON.stringify({
        action: GameAction.lastCard,
        data: 0,
      } as IGameMessage),
    );

    const message = JSON.parse(
      await waitForSocketMessage(session1),
    ) as IGameServerMessage;
    const gameAfter = await Game.findById(game._id);
    expect(message.action).toBe(GameActionServer.lastCard);
    expect(gameAfter?.players[0].announcingLastCard).toBe(true);
  });

  test("Too many cards", async () => {
    session1.send(
      JSON.stringify({
        action: GameAction.lastCard,
        data: 0,
      } as IGameMessage),
    );

    const message = JSON.parse(
      await waitForSocketMessage(session1),
    ) as IGameServerMessage;
    const gameAfter = await Game.findById(game._id);
    expect(message.action).toBe(GameActionServer.error);
    expect(message.data).toBe(GameError.conditionsNotMet);
    expect(gameAfter?.players[0].announcingLastCard).toBe(false);
  });

  test("Correct no announcement accusation", async () => {
    const dbHandCard = await Card.findOne({
      symbol: CardSymbol.one,
      color: CardColor.red,
    });
    const dbDiscardCard = await Card.findOne({
      symbol: CardSymbol.zero,
      color: CardColor.red,
    });
    game.players[0].hand = [dbHandCard!._id, dbHandCard!._id];
    game.discardPile.push(dbDiscardCard!._id);
    await game.save();

    session1.send(
      JSON.stringify({
        action: GameAction.playCard,
        data: 0,
      } as IGameMessage),
    );
    await waitForSocketMessage(session1);
    await waitForSocketMessage(session1);
    session2.send(
      JSON.stringify({
        action: GameAction.accuse,
        data: game.players[0].user.toString(),
      } as IGameMessage),
    );

    const message = JSON.parse(
      await waitForSocketMessage(session1),
    ) as IGameServerMessage;
    const gameAfter = await Game.findById(game._id);
    expect(message.action).toBe(GameActionServer.accuse);
    expect(gameAfter?.players[0].hand.length).toBe(
      game.players[0].hand.length + 1,
    );
  });
});

describe("House rules", async () => {
  describe("Interjection", () => {
    test("Correct interjection", async () => {
      const dbCard = await Card.findOne({
        symbol: CardSymbol.one,
        color: CardColor.red,
      });
      game.players[1].hand.push(dbCard!._id);
      game.discardPile.push(dbCard!._id);
      game.houseRules.generalRules.push(HouseRule.interjections);
      await game.save();

      session2.send(
        JSON.stringify({
          action: GameAction.playCard,
          data: 7,
        } as IGameMessage),
      );

      const message = JSON.parse(
        await waitForSocketMessage(session2),
      ) as IGameServerMessage;

      const gameAfter = await Game.findById(game._id);
      expect(message.action).toBe(GameActionServer.playCard);
      expect(gameAfter!.discardPile.length).toBe(game.discardPile.length + 1);
      expect(gameAfter!.players[1].hand.length).toBe(
        game.players[1].hand.length - 1,
      );
    });

    test("Incorrect interjection, rule disabled", async () => {
      const dbCard = await Card.findOne({
        symbol: CardSymbol.one,
        color: CardColor.red,
      });
      game.players[1].hand.push(dbCard!._id);
      game.discardPile.push(dbCard!._id);
      await game.save();

      session2.send(
        JSON.stringify({
          action: GameAction.playCard,
          data: 7,
        } as IGameMessage),
      );

      const message = JSON.parse(
        await waitForSocketMessage(session2),
      ) as IGameServerMessage;
      const gameAfter = await Game.findById(game._id);
      expect(message.action).toBe(GameActionServer.error);
      expect(message.data).toBe(GameError.outOfTurn);
      expect(gameAfter!.discardPile.length).toBe(game.discardPile.length);
      expect(gameAfter!.players[1].hand.length).toBe(
        game.players[1].hand.length,
      );
    });

    test("Incorrect interjection, unplayable card", async () => {
      const dbHandCard = await Card.findOne({
        symbol: CardSymbol.one,
        color: CardColor.red,
      });
      const dbDiscardCard = await Card.findOne({
        symbol: CardSymbol.zero,
        color: CardColor.blue,
      });
      game.houseRules.generalRules.push(HouseRule.interjections);
      game.players[1].hand.push(dbHandCard!._id);
      game.discardPile.push(dbDiscardCard!._id);
      await game.save();

      session2.send(
        JSON.stringify({
          action: GameAction.playCard,
          data: 7,
        } as IGameMessage),
      );

      const message = JSON.parse(
        await waitForSocketMessage(session2),
      ) as IGameServerMessage;
      const gameAfter = await Game.findById(game._id);
      expect(message.action).toBe(GameActionServer.error);
      expect(message.data).toBe(GameError.conditionsNotMet);
      expect(gameAfter!.discardPile.length).toBe(game.discardPile.length);
      expect(gameAfter!.players[1].hand.length).toBe(
        game.players[1].hand.length,
      );
    });
  });
});

test("End game", async () => {
  const dbHandCard = await Card.findOne({
    symbol: CardSymbol.one,
    color: CardColor.red,
  });
  const dbDiscardCard = await Card.findOne({
    symbol: CardSymbol.zero,
    color: CardColor.red,
  });
  game.players[0].hand = [dbHandCard!._id];
  game.winningPlayers.push(game.players[2].user);
  game.discardPile.push(dbDiscardCard!._id);
  await game.save();

  const session1 = new WebSocket(`ws://localhost:3000/game/${game.id}/ws`, {
    // @ts-expect-error
    headers: { Cookie: `authorization=${token1}` },
  });
  await waitForSocketConnection(session1);
  const session2 = new WebSocket(`ws://localhost:3000/game/${game.id}/ws`, {
    // @ts-expect-error
    headers: { Cookie: `authorization=${token2}` },
  });
  await waitForSocketConnection(session2);
  session1.send(
    JSON.stringify({
      action: GameAction.playCard,
      data: 0,
    } as IGameMessage),
  );

  const message = JSON.parse(
    await waitForSocketMessage(session1),
  ) as IGameServerMessage;
  const gameAfter = await Game.findById(game._id);
  expect(message.action).toBe(GameActionServer.endGame);
  expect(message.data[0]).toEqual(users[2].username);
  expect(message.data[1]).toEqual(users[0].username);
  expect(gameAfter).toBeNull();
});
