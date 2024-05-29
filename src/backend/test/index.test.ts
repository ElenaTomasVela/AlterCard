import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { app } from "../src";
import { treaty } from "@elysiajs/eden";
import mongoose from "mongoose";
import { IPopulatedUser, IUser, User, encryptUser } from "../src/models/user";
import {
  IWaitingRoomMessage,
  IWaitingRoomServerMessage,
  WaitingRoom,
  WaitingRoomAction,
  WaitingRoomError,
  WaitingRoomServerAction,
} from "../src/models/waitingRoom";
import {
  getCookieFromResponse,
  waitForSocketConnection,
  waitForSocketMessage,
} from "./utils";
import { houseRule } from "../src/models/houseRule";
import {
  Game,
  GameAction,
  GameActionServer,
  GameError,
  GamePromptType,
  IGame,
  IGameMessage,
  IGameServerMessage,
  gameFromWaitingRoom,
} from "../src/models/game";
import { seedCards } from "../src/seeders/seedCards";
import {
  Card,
  CardColor,
  CardDeck,
  CardSymbol,
  ICard,
} from "../src/models/card";

const api = treaty(app);

const users = [
  {
    username: "todelete",
    password: "todelete",
  },
  {
    username: "user1",
    password: "password1",
  },
  {
    username: "user2",
    password: "password2",
  },
  {
    username: "user3",
    password: "password3",
  },
];

let token1;
let token2;

beforeAll(async () => {
  await mongoose.connection.dropDatabase();
  const encryptedUsers = await Promise.all(users.map((u) => encryptUser(u)));
  await User.insertMany(encryptedUsers);
  seedCards();
});

describe("Database", () => {
  describe("User", () => {
    test("Create User", async () => {
      const user = new User({
        username: "testuser",
        password: "testpassword",
      });
      const currentUsers = await User.find();
      const nUsers = currentUsers.length;

      await user.save();

      const newUsers = await User.find();
      const nNewUsers = newUsers.length;

      expect(nNewUsers).toBe(nUsers + 1);
    });
    test("Delete User", async () => {
      const currentUsers = await User.find();
      const nUsers = currentUsers.length;

      await User.deleteOne();

      const newUsers = await User.find();
      const nNewUsers = newUsers.length;

      expect(nNewUsers).toBe(nUsers - 1);
    });
  });
});

describe("Authentication", () => {
  describe("Log in", () => {
    test("Correct log-in", async () => {
      const { status } = await api.user.login.post(users[1]);

      expect(status).toBe(200);
    });
    test.each([
      {
        username: "wronguser",
        password: "wrongpassword",
      },
      {
        username: "user1",
        password: "wrongpassword",
      },
    ])("Incorrect log-in", async (user) => {
      const { status } = await api.user.login.post(user);

      expect(status).toBe(400);
    });
  });

  describe("Sign-up", () => {
    test("Correct sign-up", async () => {
      const user = {
        username: "testuser2",
        password: "testpassword",
      };

      const currentUsers = await User.find();
      const nUsers = currentUsers.length;

      const { status } = await api.user.index.post(user);

      const newUsers = await User.find();
      const nNewUsers = newUsers.length;

      expect(status).toBe(200);
      expect(nNewUsers).toBe(nUsers + 1);
    });

    //TODO: Parameterize this test
    test("Incorrect sign-up", async () => {});

    test("Password is encrypted", async () => {
      const user = {
        username: "testuser3",
        password: "testpassword",
      };

      const { status } = await api.user.index.post(user);
      const dbUser = await User.findOne({ username: user.username });
      expect(dbUser!.password).not.toBe(user.password);
    });
  });
});

describe("Room", () => {
  beforeEach(async () => {
    await WaitingRoom.deleteMany({});
    const user = await User.findOne({ username: users[1].username });

    WaitingRoom.create({
      host: user!._id,
      users: [{ user: user!._id }],
    });
  });

  test("Authenticated room creation", async () => {
    const { status: loginStatus, response } = await api.user.login.post(
      users[1],
    );
    const token = getCookieFromResponse(response)["authorization"];

    const previousRoomCount = (await WaitingRoom.find()).length;
    const { status, data: roomId } = await api.room.index.post(
      {},
      { headers: { Cookie: `authorization=${token}` } },
    );
    const currentRoomCount = (await WaitingRoom.find()).length;
    const room = await WaitingRoom.findById(roomId).populate<{
      host: IPopulatedUser;
    }>("host", "username");

    expect(loginStatus).toBe(200);
    expect(status).toBe(200);
    expect(roomId).toBeString;
    expect(room).not.toBeNull();
    expect(room!.host.username).toBe(users[1].username);
    expect(room!.users.length).toBe(1);
    expect(currentRoomCount).toBe(previousRoomCount + 1);
  });
  test("Unauthenticated room creation", async () => {
    const { status } = await api.room.index.post({});

    expect(status).toBe(401);
  });

  test("Authenticated room list", async () => {
    const { response, status: loginStatus } = await api.user.login.post(
      users[1],
    );
    const token = getCookieFromResponse(response)["authorization"];

    const roomIds = (await WaitingRoom.find()).map((r) => r.id);

    const { data, status } = await api.room.index.get({
      headers: {
        Cookie: `authorization=${token}`,
        contentType: "application/json",
      },
    });

    const fetchedRoomIds = data!.map((r: any) => r._id);

    expect(status).toBe(200);
    expect(fetchedRoomIds).toEqual(roomIds);
  });

  test.skip("Authenticated room get", async () => {
    const { response } = await api.user.login.post(users[1]);
    const token = getCookieFromResponse(response)["authorization"];

    const roomId = (await WaitingRoom.findOne())!.id;
    const { data, status } = await api.room(roomId).get({
      headers: {
        Cookie: `authorization=${token}`,
        contentType: "application/json",
      },
    });

    expect(status).toBe(200);
    expect(data).toBe(roomId);
  });

  test("Authenticated room join", async () => {
    const waitingRoomBefore = await WaitingRoom.findOne();
    const roomId = waitingRoomBefore!.id;
    const { response } = await api.user.login.post(users[1]);
    const token = getCookieFromResponse(response)["authorization"];

    // Eden Treaty has a buggy websocket implementation, so Bun's is
    // being used instead, at the cost of type safety
    const session = new WebSocket(`ws://localhost:3000/room/${roomId}/ws`, {
      // @ts-expect-error
      headers: { Cookie: `authorization=${token}` },
    });

    const promise = waitForSocketConnection(session);

    return expect(promise).resolves.toBeUndefined();
  });
  test("Unauthenticated room join", async () => {
    const waitingRoom = await WaitingRoom.findOne();

    const session = new WebSocket(
      `ws://localhost:3000/room/${waitingRoom!.id}/ws`,
    );
    const promise = waitForSocketConnection(session);
    expect(promise).rejects.toThrow();
  });
  test("Incorrect room join", async () => {
    const session = new WebSocket(
      `ws://localhost:3000/room/thisisincorrect/ws`,
    );
    const promise = waitForSocketConnection(session);
    expect(promise).rejects.toThrow();
  });

  test("Player join notified", async () => {
    const waitingRoomBefore = await WaitingRoom.findOne();
    const roomId = waitingRoomBefore!.id;
    const { response: response1 } = await api.user.login.post(users[1]);
    const { response: response2 } = await api.user.login.post(users[2]);
    const token1 = getCookieFromResponse(response1)["authorization"];
    const token2 = getCookieFromResponse(response2)["authorization"];

    const session1 = new WebSocket(`ws://localhost:3000/room/${roomId}/ws`, {
      // @ts-expect-error
      headers: { Cookie: `authorization=${token1}` },
    });
    await waitForSocketConnection(session1);

    const session2 = new WebSocket(`ws://localhost:3000/room/${roomId}/ws`, {
      // @ts-expect-error
      headers: { Cookie: `authorization=${token2}` },
    });
    await waitForSocketConnection(session2);

    const message = JSON.parse(
      await waitForSocketMessage(session1),
    ) as IWaitingRoomServerMessage;

    expect(message.action).toBe(WaitingRoomServerAction.playerJoined);
  });
  test("Player leave notified", async () => {
    const waitingRoom = await WaitingRoom.findOne();
    const roomId = waitingRoom!.id;
    const { response: response1 } = await api.user.login.post(users[1]);
    const { response: response2 } = await api.user.login.post(users[2]);
    const token1 = getCookieFromResponse(response1)["authorization"];
    const token2 = getCookieFromResponse(response2)["authorization"];

    const session1 = new WebSocket(`ws://localhost:3000/room/${roomId}/ws`, {
      // @ts-expect-error
      headers: { Cookie: `authorization=${token1}` },
    });
    await waitForSocketConnection(session1);
    const session2 = new WebSocket(`ws://localhost:3000/room/${roomId}/ws`, {
      // @ts-expect-error
      headers: { Cookie: `authorization=${token2}` },
    });
    await waitForSocketConnection(session2);
    await waitForSocketMessage(session1);

    const waitingRoomBefore = await WaitingRoom.findById(waitingRoom!.id);
    session2.close();
    const message = JSON.parse(
      await waitForSocketMessage(session1),
    ) as IWaitingRoomServerMessage;
    const waitingRoomAfter = await WaitingRoom.findById(waitingRoom!.id);

    expect(message.action).toBe(WaitingRoomServerAction.playerLeft);
    expect(waitingRoomAfter!.users.length).toBe(
      waitingRoomBefore!.users.length - 1,
    );
  });

  test("Player ready", async () => {
    const waitingRoomBefore = await WaitingRoom.findOne();
    const roomId = waitingRoomBefore!.id;
    const { response: response1 } = await api.user.login.post(users[1]);
    const { response: response2 } = await api.user.login.post(users[2]);
    const token1 = getCookieFromResponse(response1)["authorization"];
    const token2 = getCookieFromResponse(response2)["authorization"];

    const session1 = new WebSocket(`ws://localhost:3000/room/${roomId}/ws`, {
      // @ts-expect-error
      headers: { Cookie: `authorization=${token1}` },
    });
    await waitForSocketConnection(session1);
    const session2 = new WebSocket(`ws://localhost:3000/room/${roomId}/ws`, {
      // @ts-expect-error
      headers: { Cookie: `authorization=${token2}` },
    });
    await waitForSocketConnection(session2);
    await waitForSocketMessage(session2);

    session1.send(JSON.stringify({ action: "ready", data: true }));
    const message = JSON.parse(
      await waitForSocketMessage(session2),
    ) as IWaitingRoomServerMessage;

    const waitingRoomAfter = await WaitingRoom.findById(waitingRoomBefore!.id);
    const readyBefore = waitingRoomBefore!.users[0].ready;
    const readyAfter = waitingRoomAfter!.users[0].ready;

    expect(message.data).toBe(true);
    expect(message.user).toBe(users[1].username);
    expect(readyAfter).toBe(!readyBefore);
  });

  test("Add house rule", async () => {
    const waitingRoomBefore = await WaitingRoom.findOne();
    const roomId = waitingRoomBefore!.id;
    const { response: response1 } = await api.user.login.post(users[1]);
    const { response: response2 } = await api.user.login.post(users[2]);
    const token1 = getCookieFromResponse(response1)["authorization"];
    const token2 = getCookieFromResponse(response2)["authorization"];

    const session1 = new WebSocket(`ws://localhost:3000/room/${roomId}/ws`, {
      // @ts-expect-error
      headers: { Cookie: `authorization=${token1}` },
    });
    await waitForSocketConnection(session1);
    const session2 = new WebSocket(`ws://localhost:3000/room/${roomId}/ws`, {
      // @ts-expect-error
      headers: { Cookie: `authorization=${token2}` },
    });
    await waitForSocketConnection(session2);
    await waitForSocketMessage(session2);

    session1.send(
      JSON.stringify({ action: "addRule", data: houseRule.stackDraw }),
    );
    const message = JSON.parse(
      await waitForSocketMessage(session2),
    ) as IWaitingRoomServerMessage;

    const waitingRoomAfter = await WaitingRoom.findById(waitingRoomBefore!.id);

    expect(message.action).toBe(WaitingRoomServerAction.addRule);
    expect(message.data).toBe(houseRule.stackDraw);
    expect(waitingRoomAfter!.houseRules.length).toBe(
      waitingRoomBefore!.houseRules.length + 1,
    );
  });

  test("Correct game start", async () => {
    const gamesBefore = await Game.find().countDocuments();
    const waitingRoomBefore = await WaitingRoom.findOne();
    const roomId = waitingRoomBefore!.id;
    const { response: response1 } = await api.user.login.post(users[1]);
    const { response: response2 } = await api.user.login.post(users[2]);
    const token1 = getCookieFromResponse(response1)["authorization"];
    const token2 = getCookieFromResponse(response2)["authorization"];
    const cardDeck = await CardDeck.findOne();

    // Connection
    const session1 = new WebSocket(`ws://localhost:3000/room/${roomId}/ws`, {
      // @ts-expect-error
      headers: { Cookie: `authorization=${token1}` },
    });
    await waitForSocketConnection(session1);
    const session2 = new WebSocket(`ws://localhost:3000/room/${roomId}/ws`, {
      // @ts-expect-error
      headers: { Cookie: `authorization=${token2}` },
    });
    await waitForSocketConnection(session2);
    await waitForSocketMessage(session2);

    // Pre-Game config
    session1.send(
      JSON.stringify({
        action: WaitingRoomAction.ready,
        data: true,
      } as IWaitingRoomMessage),
    );
    await waitForSocketMessage(session1);
    session1.send(
      JSON.stringify({
        action: WaitingRoomAction.setDeck,
        data: cardDeck!.id,
      } as IWaitingRoomMessage),
    );
    await waitForSocketMessage(session1);
    session2.send(
      JSON.stringify({
        action: WaitingRoomAction.ready,
        data: true,
      } as IWaitingRoomMessage),
    );
    await waitForSocketMessage(session1);

    // Start
    session1.send(
      JSON.stringify({
        action: WaitingRoomAction.start,
      } as IWaitingRoomMessage),
    );

    const message = JSON.parse(
      await waitForSocketMessage(session2),
    ) as IWaitingRoomServerMessage;

    // Correct creation
    const gamesAfter = await Game.find().countDocuments();
    expect(message.action).toBe(WaitingRoomServerAction.start);
    expect(gamesAfter).toBe(gamesBefore + 1);

    // Correct initial state
    const game = await Game.findById(message.data);
    expect(game?.players.every((p) => p.hand.length == 7)).toBeTrue();
    expect(game?.discardPile.length).toBe(1);
    expect(game?.drawPile.length).toBe(
      cardDeck!.cards.length - game!.players.length * 7 - 1,
    );
  });
  test("Incorrect game start, not ready", async () => {
    const waitingRoomBefore = await WaitingRoom.findOne();
    const roomId = waitingRoomBefore!.id;
    const { response: response1 } = await api.user.login.post(users[1]);
    const { response: response2 } = await api.user.login.post(users[2]);
    const token1 = getCookieFromResponse(response1)["authorization"];
    const token2 = getCookieFromResponse(response2)["authorization"];

    const session1 = new WebSocket(`ws://localhost:3000/room/${roomId}/ws`, {
      // @ts-expect-error
      headers: { Cookie: `authorization=${token1}` },
    });
    await waitForSocketConnection(session1);
    const session2 = new WebSocket(`ws://localhost:3000/room/${roomId}/ws`, {
      // @ts-expect-error
      headers: { Cookie: `authorization=${token2}` },
    });
    await waitForSocketMessage(session1);

    session1.send(
      JSON.stringify({
        action: WaitingRoomAction.start,
      } as IWaitingRoomMessage),
    );
    const message = JSON.parse(
      await waitForSocketMessage(session1),
    ) as IWaitingRoomServerMessage;

    expect(message.data).toBe(WaitingRoomError.notReady);
  });
  test("Incorrect game start, no players", async () => {
    const waitingRoomBefore = await WaitingRoom.findOne();
    const roomId = waitingRoomBefore!.id;
    const { response: response1 } = await api.user.login.post(users[1]);
    const token1 = getCookieFromResponse(response1)["authorization"];

    const session1 = new WebSocket(`ws://localhost:3000/room/${roomId}/ws`, {
      // @ts-expect-error
      headers: { Cookie: `authorization=${token1}` },
    });
    await waitForSocketConnection(session1);

    session1.send(
      JSON.stringify({
        action: WaitingRoomAction.start,
      } as IWaitingRoomMessage),
    );
    const message = JSON.parse(
      await waitForSocketMessage(session1),
    ) as IWaitingRoomServerMessage;

    expect(message.data).toBe(WaitingRoomError.notEnoughPlayers);
  });
  test("Incorrect game start, wrong host", async () => {
    const waitingRoomBefore = await WaitingRoom.findOne();
    const roomId = waitingRoomBefore!.id;
    const { response: response1 } = await api.user.login.post(users[1]);
    const { response: response2 } = await api.user.login.post(users[2]);
    const token1 = getCookieFromResponse(response1)["authorization"];
    const token2 = getCookieFromResponse(response2)["authorization"];

    const session1 = new WebSocket(`ws://localhost:3000/room/${roomId}/ws`, {
      // @ts-expect-error
      headers: { Cookie: `authorization=${token1}` },
    });
    await waitForSocketConnection(session1);
    const session2 = new WebSocket(`ws://localhost:3000/room/${roomId}/ws`, {
      // @ts-expect-error
      headers: { Cookie: `authorization=${token2}` },
    });
    await waitForSocketConnection(session2);
    await waitForSocketMessage(session1);

    session1.send(
      JSON.stringify({
        action: WaitingRoomAction.ready,
        data: true,
      } as IWaitingRoomMessage),
    );
    session2.send(
      JSON.stringify({
        action: WaitingRoomAction.ready,
        data: true,
      } as IWaitingRoomMessage),
    );
    await waitForSocketMessage(session1);

    session2.send(
      JSON.stringify({
        action: WaitingRoomAction.start,
      } as IWaitingRoomMessage),
    );
    const message = JSON.parse(
      await waitForSocketMessage(session2),
    ) as IWaitingRoomServerMessage;

    expect(message.data).toBe(WaitingRoomError.notTheHost);
  });

  test("Host exit", async () => {
    const waitingRoomBefore = await WaitingRoom.findOne().populate<{
      host: IUser;
    }>("host");
    const roomId = waitingRoomBefore!.id;
    const { response: response1 } = await api.user.login.post(users[1]);
    const { response: response2 } = await api.user.login.post(users[2]);
    const token1 = getCookieFromResponse(response1)["authorization"];
    const token2 = getCookieFromResponse(response2)["authorization"];

    const session1 = new WebSocket(`ws://localhost:3000/room/${roomId}/ws`, {
      // @ts-expect-error
      headers: { Cookie: `authorization=${token1}` },
    });
    await waitForSocketConnection(session1);
    const session2 = new WebSocket(`ws://localhost:3000/room/${roomId}/ws`, {
      // @ts-expect-error
      headers: { Cookie: `authorization=${token2}` },
    });
    await waitForSocketConnection(session2);
    await waitForSocketMessage(session2);

    session1.close();
    await waitForSocketMessage(session2);
    const ownerPromotionMessage = JSON.parse(
      await waitForSocketMessage(session2),
    ) as IWaitingRoomServerMessage;

    const waitingRoomAfter = await WaitingRoom.findById(roomId).populate<{
      host: IUser;
    }>("host");

    expect(ownerPromotionMessage.action).toBe(WaitingRoomServerAction.newHost);
    expect(waitingRoomBefore?.host.username).toBe(users[1].username);
    expect(waitingRoomAfter?.host.username).toBe(users[2].username);
  });

  test("All users exit", async () => {
    const waitingRoomBefore = await WaitingRoom.findOne();
    const roomId = waitingRoomBefore!.id;
    const { response: response1 } = await api.user.login.post(users[1]);
    const token1 = getCookieFromResponse(response1)["authorization"];

    const session1 = new WebSocket(`ws://localhost:3000/room/${roomId}/ws`, {
      // @ts-expect-error
      headers: { Cookie: `authorization=${token1}` },
    });
    await waitForSocketConnection(session1);

    session1.close();
    const promise = new Promise<void>((resolve) => {
      const interval = setInterval(async () => {
        const waitingRoomAfter = await WaitingRoom.findById(roomId);
        if (waitingRoomAfter == null) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });

    expect(promise).resolves.toBeUndefined();
  });
});

describe("Game", () => {
  let token1: string;
  let token2: string;
  let game: mongoose.Document & IGame;
  beforeAll(async () => {
    const { response: response1 } = await api.user.login.post(users[1]);
    const { response: response2 } = await api.user.login.post(users[2]);
    token1 = getCookieFromResponse(response1)["authorization"];
    token2 = getCookieFromResponse(response2)["authorization"];
  });
  beforeEach(async () => {
    WaitingRoom.deleteMany({});
    Game.deleteMany({});

    const dbUsers = await User.find();
    const deck = await CardDeck.findOne();

    const waitingRoom = new WaitingRoom({
      host: dbUsers[0]._id,
      users: [{ user: dbUsers[0]._id }, { user: dbUsers[1]._id }],
      deck: deck!._id,
    });
    game = await gameFromWaitingRoom(waitingRoom);
  });
  test.skip("Draw when starting turn", async () => {});
  test.skip("Game end when 1 player remaining", async () => {});

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

    const message = JSON.parse(
      await waitForSocketMessage(session2),
    ) as IGameServerMessage;
    const gameAfter = await Game.findById(game._id);
    expect(message.action).toBe(GameActionServer.playCard);
    expect(gameAfter!.discardPile.length).toBe(game.discardPile.length + 1);
    expect(gameAfter!.players[0].hand.length).toBe(
      game.players[0].hand.length - 1,
    );
  });
  test("Wrong play, unplayable card", async () => {
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

    const message = JSON.parse(
      await waitForSocketMessage(session1),
    ) as IGameServerMessage;
    const gameAfter = await Game.findById(game._id);
    expect(message.action).toBe(GameActionServer.error);
    expect(message.data).toBe(GameError.conditionsNotMet);
    expect(gameAfter!.discardPile.length).toBe(game.discardPile.length);
    expect(gameAfter!.players[0].hand.length).toBe(game.players[0].hand.length);
  });
  test("Wrong play, out of turn", async () => {
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

  test.skip("Invalid action after playing wildcard", async () => {});

  test("Draw card", async () => {
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
  test.skip("Pass on second draw", async () => {});
  test("Play drawn card", async () => {
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
    expect(gameAfter!.players[0].hand.length).toBe(game.players[0].hand.length);
  });

  test("Play drawn effect card", async () => {
    const dbPlayableCard = await Card.findOne({
      symbol: CardSymbol.changeColor,
      color: CardColor.wild,
    });
    game.drawPile.push(dbPlayableCard!._id);
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
    expect(promptMessage.data).toBe(GamePromptType.chooseColor);
    expect(gameAfter!.drawPile.length).toBe(game.drawPile.length - 1);
    expect(gameAfter!.discardPile.length).toBe(game.discardPile.length + 1);
    expect(gameAfter!.players[0].hand.length).toBe(game.players[0].hand.length);
  });

  test("Change color", async () => {
    const dbPlayableCard = await Card.findOne({
      symbol: CardSymbol.changeColor,
      color: CardColor.wild,
    });
    game.players[0].hand.unshift(dbPlayableCard!._id);
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

  test.skip("Draw 2 effect", async () => {});

  test("Stack Draw cards", async () => {
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
    await waitForSocketMessage(session2);
    session2.send(
      JSON.stringify({
        action: GameAction.answerPrompt,
        data: game.players[1].hand.length - 1,
      } as IGameMessage),
    );

    await waitForSocketMessage(session2);
    const message = JSON.parse(
      await waitForSocketMessage(session2),
    ) as IGameServerMessage;
    const gameAfter = await Game.findById(game._id);
    const prompt = gameAfter?.promptQueue.slice(-1)[0];
    expect(message.action).toBe(GameActionServer.requestPrompt);
    expect(message.data).toBe(GamePromptType.stackDrawCard);
    expect(prompt!.data).toBe(4);
  });

  test("Skip turn effect", async () => {
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
    const message = JSON.parse(
      await waitForSocketMessage(session2),
    ) as IGameServerMessage;
    const gameAfter = await Game.findById(game._id);
    expect(message.action).toBe(GameActionServer.startTurn);
    expect(message.data).toBe(0);
    expect(gameAfter?.currentPlayer).toBe(0);
  });
  test.skip("Draw 4 effect", async () => {});
  test("Flip turn order effect", async () => {
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
  });

  test("Announce last card correctly", async () => {
    const dbPlayableCard = await Card.findOne({
      symbol: CardSymbol.changeColor,
      color: CardColor.wild,
    });
    game.players[0].hand = [dbPlayableCard!._id, dbPlayableCard!._id];
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
  test("Announce last card when having more cards", async () => {
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

  test("Announce last card when having more cards", async () => {
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
  test("Incorrect no announcement accusation", async () => {
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
      JSON.stringify({ action: GameAction.lastCard } as IGameMessage),
    );
    await waitForSocketMessage(session2);
    session1.send(
      JSON.stringify({
        action: GameAction.playCard,
        data: 0,
      } as IGameMessage),
    );
    await waitForSocketMessage(session2);
    await waitForSocketMessage(session2);
    session2.send(
      JSON.stringify({
        action: GameAction.accuse,
        data: game.players[0].user.toString(),
      } as IGameMessage),
    );

    const message = JSON.parse(
      await waitForSocketMessage(session2),
    ) as IGameServerMessage;
    const gameAfter = await Game.findById(game._id);
    expect(message.action).toBe(GameActionServer.error);
    expect(message.data).toBe(GameError.conditionsNotMet);
    expect(gameAfter?.players[0].hand.length).toBe(
      game.players[0].hand.length - 1,
    );
  });

  test.skip("Correct draw 4 accusation", async () => {});
  test.skip("Incorrect draw 4 accusation", async () => {});

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
    expect(message.data[0]).toEqual(users[1].username);
    expect(gameAfter).toBeNull();
  });
});
