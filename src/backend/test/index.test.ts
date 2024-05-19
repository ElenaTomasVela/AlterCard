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
    await waitForSocketMessage(session1);

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
    await waitForSocketMessage(session1);

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
    await waitForSocketMessage(session1);

    // Pre-Game config
    session1.send(
      JSON.stringify({
        action: WaitingRoomAction.ready,
        data: true,
      } as IWaitingRoomMessage),
    );
    session1.send(
      JSON.stringify({
        action: WaitingRoomAction.setDeck,
        data: cardDeck!.id,
      } as IWaitingRoomMessage),
    );
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
    await waitForSocketConnection(session2);
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
    await waitForSocketMessage(session1);

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
  let blueOne: mongoose.Document & ICard;
  let redTwo: mongoose.Document & ICard;
  let yellowOne: mongoose.Document & ICard;
  beforeAll(async () => {
    const { response: response1 } = await api.user.login.post(users[1]);
    const { response: response2 } = await api.user.login.post(users[2]);
    token1 = getCookieFromResponse(response1)["authorization"];
    token2 = getCookieFromResponse(response2)["authorization"];

    blueOne = (await Card.findOne({
      symbol: CardSymbol.one,
      color: CardColor.blue,
    }))!;
    redTwo = (await Card.findOne({
      symbol: CardSymbol.two,
      color: CardColor.red,
    }))!;
    yellowOne = (await Card.findOne({
      symbol: CardSymbol.one,
      color: CardColor.yellow,
    }))!;
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
    game.players[0].hand.push(blueOne._id, yellowOne._id);
    game.discardPile.push(blueOne._id);
    await game.save();
  });
  test.skip("Draw when starting turn", async () => {});
  test.skip("Game end when 1 player remaining", async () => {});

  test("Correct play", async () => {
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
        data: 6,
      } as IGameMessage),
    );

    const message = JSON.parse(
      await waitForSocketMessage(session2),
    ) as IGameServerMessage;
    expect(message.action).toBe(GameActionServer.playCard);
  });
  test.skip("Wrong play, unplayable card", async () => {});
  test.skip("Wrong play, out of turn", async () => {});

  test.skip("Choose color after playing wildcard", async () => {});
  test.skip("Invalid action after playing wildcard", async () => {});

  test.skip("Draw card", async () => {});
  test.skip("Pass on second draw", async () => {});
  test.skip("Play drawn card", async () => {});

  test.skip("Draw 2 effect", async () => {});
  test.skip("Skip turn effect", async () => {});
  test.skip("Draw 4 effect", async () => {});
  test.skip("Flip turn order effect", async () => {});

  test.skip("Announce last card correctly", async () => {});
  test.skip("Announce last card when having more cards", async () => {});

  test.skip("Correct no announcement accusation", async () => {});
  test.skip("Incorrect no announcement accusation", async () => {});

  test.skip("Correct draw 4 accusation", async () => {});
  test.skip("Incorrect draw 4 accusation", async () => {});
});
