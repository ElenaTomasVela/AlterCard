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
import { Game } from "../src/models/game/schema";
import { seedCards } from "../src/seeders/seedCards";
import { CardDeck } from "../src/models/card";
import { users } from "./setup";

const api = treaty(app);

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
