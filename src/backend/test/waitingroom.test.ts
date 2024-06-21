import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { app } from "../src";
import { treaty } from "@elysiajs/eden";
import { IPopulatedUser, IUser, User } from "../src/models/user";
import {
  IWaitingRoom,
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
import {
  DrawHouseRule,
  HouseRule,
  IHouseRuleConfig,
} from "../src/models/houseRule";
import { Game } from "../src/models/game/schema";
import { CardDeck } from "../src/models/card";
import { users } from "./setup";
import mongoose, { Document } from "mongoose";

const api = treaty(app);

beforeEach(async () => {
  await WaitingRoom.deleteMany({});
  const user = await User.findOne({ username: users[1].username });

  await WaitingRoom.create({
    host: user!._id,
    users: [{ user: user!._id }],
  });
});

test("Authenticated room creation", async () => {
  const { status: loginStatus, response } = await api.user.login.post(users[1]);
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
  const { response } = await api.user.login.post(users[1]);
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

test("Authenticated room get", async () => {
  const { response } = await api.user.login.post(users[1]);
  const token = getCookieFromResponse(response)["authorization"];

  const roomId = (await WaitingRoom.findOne())!.id;
  // Eden Treaty seems to have problems url parameters in this case, so
  // the fetching has to be done manually
  const response2 = await app
    .handle(
      new Request(
        `http://${app.server?.hostname}:${app.server?.port}/room/${roomId}`,
        {
          headers: { Cookie: `authorization=${token}` },
        },
      ),
    )
    .then((r) => r.text());
  const waitingRoomObject = JSON.parse(response2) as IWaitingRoom & Document;

  expect(waitingRoomObject._id).toBe(roomId);
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
  const session = new WebSocket(`ws://localhost:3000/room/thisisincorrect/ws`);
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

test("Authenticated deck listing", async () => {
  const { response } = await api.user.login.post(users[1]);
  const token = getCookieFromResponse(response)["authorization"];

  const { data, status } = await api.deck.index.get({
    headers: {
      Cookie: `authorization=${token}`,
      contentType: "application/json",
    },
  });

  const decks = await CardDeck.find();
  expect(status).toBe(200);
  expect(data?.length).toBe(decks.length);
});

test("Unauthenticated deck listing", async () => {
  const { status } = await api.deck.index.get({});

  expect(status).toBe(401);
});

describe("Connected", () => {
  let waitingRoom: IWaitingRoom & mongoose.Document;
  let token1;
  let token2;
  let session1: WebSocket;
  let session2: WebSocket;

  beforeEach(async () => {
    waitingRoom = (await WaitingRoom.findOne())!;
    const roomId = waitingRoom!.id;
    const { response: response1 } = await api.user.login.post(users[1]);
    const { response: response2 } = await api.user.login.post(users[2]);
    token1 = getCookieFromResponse(response1)["authorization"];
    token2 = getCookieFromResponse(response2)["authorization"];

    session1 = new WebSocket(`ws://localhost:3000/room/${roomId}/ws`, {
      // @ts-expect-error
      headers: { Cookie: `authorization=${token1}` },
    });
    await waitForSocketConnection(session1);
    session2 = new WebSocket(`ws://localhost:3000/room/${roomId}/ws`, {
      // @ts-expect-error
      headers: { Cookie: `authorization=${token2}` },
    });
    await waitForSocketConnection(session2);
    await waitForSocketMessage(session1);
    await waitForSocketMessage(session2);
  });

  test("Player ready", async () => {
    session1.send(JSON.stringify({ action: "ready", data: true }));
    const message = JSON.parse(
      await waitForSocketMessage(session2),
    ) as IWaitingRoomServerMessage;

    const waitingRoomAfter = await WaitingRoom.findById(waitingRoom!.id);
    const readyBefore = waitingRoom!.users[0].ready;
    const readyAfter = waitingRoomAfter!.users[0].ready;

    expect(message.data).toBe(true);
    expect(message.user).toBe(users[1].username);
    expect(readyAfter).toBe(!readyBefore);
  });
  test("Invalid player ready message", async () => {
    session1.send(JSON.stringify({ action: "ready", data: "this is invalid" }));
    const message = JSON.parse(
      await waitForSocketMessage(session1),
    ) as IWaitingRoomServerMessage;

    const waitingRoomAfter = await WaitingRoom.findById(waitingRoom!.id);
    const readyBefore = waitingRoom!.users[0].ready;
    const readyAfter = waitingRoomAfter!.users[0].ready;

    expect(message.action).toBe(WaitingRoomServerAction.error);
    expect(readyAfter).toBe(readyBefore);
  });

  describe("House rules", () => {
    test("Add general house rule", async () => {
      session1.send(
        JSON.stringify({ action: "addRule", data: HouseRule.interjections }),
      );
      const message = JSON.parse(
        await waitForSocketMessage(session2),
      ) as IWaitingRoomServerMessage;

      const waitingRoomAfter = await WaitingRoom.findById(waitingRoom!.id);

      expect(message.action).toBe(WaitingRoomServerAction.addRule);
      expect(message.data).toBe(HouseRule.interjections);
      expect(waitingRoomAfter!.houseRules.generalRules.length).toBe(
        waitingRoom!.houseRules.generalRules.length + 1,
      );
    });
    test("General house rule, not host", async () => {
      session2.send(
        JSON.stringify({ action: "addRule", data: HouseRule.interjections }),
      );
      const message = JSON.parse(
        await waitForSocketMessage(session2),
      ) as IWaitingRoomServerMessage;

      const waitingRoomAfter = await WaitingRoom.findById(waitingRoom!.id);

      expect(message.action).toBe(WaitingRoomServerAction.error);
      expect(message.data).toBe(WaitingRoomError.notTheHost);
      expect(waitingRoomAfter!.houseRules.generalRules.length).toBe(
        waitingRoom!.houseRules.generalRules.length,
      );
    });
    test("Add invalid house rule", async () => {
      session1.send(
        JSON.stringify({ action: "addRule", data: "An invalid rule" }),
      );
      const message = JSON.parse(
        await waitForSocketMessage(session1),
      ) as IWaitingRoomServerMessage;

      const waitingRoomAfter = await WaitingRoom.findById(waitingRoom!.id);

      expect(message.action).toBe(WaitingRoomServerAction.error);
      expect(message.data).toBe(WaitingRoomError.invalidRule);
      expect(waitingRoomAfter!.houseRules.generalRules.length).toBe(
        waitingRoom!.houseRules.generalRules.length,
      );
    });
    test("Remove general house rule", async () => {
      waitingRoom.houseRules.generalRules = [HouseRule.interjections];
      await waitingRoom.save();

      session1.send(
        JSON.stringify({ action: "removeRule", data: HouseRule.interjections }),
      );
      const message = JSON.parse(
        await waitForSocketMessage(session2),
      ) as IWaitingRoomServerMessage;

      const waitingRoomAfter = await WaitingRoom.findById(waitingRoom!.id);

      expect(message.action).toBe(WaitingRoomServerAction.removeRule);
      expect(message.data).toBe(HouseRule.interjections);
      expect(waitingRoomAfter!.houseRules.generalRules.length).toBe(
        waitingRoom!.houseRules.generalRules.length - 1,
      );
    });
    test("Remove invalid house rule", async () => {
      session1.send(
        JSON.stringify({ action: "removeRule", data: "An invalid rule" }),
      );
      const message = JSON.parse(
        await waitForSocketMessage(session1),
      ) as IWaitingRoomServerMessage;

      const waitingRoomAfter = await WaitingRoom.findById(waitingRoom!.id);

      expect(message.action).toBe(WaitingRoomServerAction.error);
      expect(message.data).toBe(WaitingRoomError.invalidRule);
      expect(waitingRoomAfter!.houseRules.generalRules.length).toBe(
        waitingRoom!.houseRules.generalRules.length,
      );
    });
    test("Remove general house rule, not host", async () => {
      waitingRoom.houseRules.generalRules = [HouseRule.interjections];
      await waitingRoom.save();

      session2.send(
        JSON.stringify({ action: "removeRule", data: HouseRule.interjections }),
      );
      const message = JSON.parse(
        await waitForSocketMessage(session2),
      ) as IWaitingRoomServerMessage;

      const waitingRoomAfter = await WaitingRoom.findById(waitingRoom!.id);

      expect(message.action).toBe(WaitingRoomServerAction.error);
      expect(message.data).toBe(WaitingRoomError.notTheHost);
      expect(waitingRoomAfter!.houseRules.generalRules.length).toBe(
        waitingRoom!.houseRules.generalRules.length,
      );
    });

    test("Add specific house rule", async () => {
      const houseRuleConfig = <IHouseRuleConfig>{
        draw: DrawHouseRule.drawUntilPlay,
      };
      session1.send(
        JSON.stringify(<IWaitingRoomMessage>{
          action: WaitingRoomAction.setRule,
          data: houseRuleConfig,
        }),
      );

      const message = JSON.parse(
        await waitForSocketMessage(session2),
      ) as IWaitingRoomServerMessage;

      const waitingRoomAfter = await WaitingRoom.findById(waitingRoom!.id);

      expect(message.action).toBe(WaitingRoomServerAction.setRule);
      expect(message.data).toEqual(houseRuleConfig);
      expect(waitingRoomAfter!.houseRules.draw).toBe(
        DrawHouseRule.drawUntilPlay,
      );
    });

    test("Add specific house rule, not host", async () => {
      const houseRuleConfig = <IHouseRuleConfig>{
        draw: DrawHouseRule.drawUntilPlay,
      };
      session2.send(
        JSON.stringify(<IWaitingRoomMessage>{
          action: WaitingRoomAction.setRule,
          data: houseRuleConfig,
        }),
      );

      const message = JSON.parse(
        await waitForSocketMessage(session2),
      ) as IWaitingRoomServerMessage;

      const waitingRoomAfter = await WaitingRoom.findById(waitingRoom!.id);

      expect(message.action).toBe(WaitingRoomServerAction.error);
      expect(message.data).toBe(WaitingRoomError.notTheHost);
      expect(waitingRoomAfter!.houseRules.draw).toBeUndefined();
    });
  });

  describe("Selecting deck", () => {
    test("Correct selection", async () => {
      const deck = await CardDeck.findOne();
      session1.send(
        JSON.stringify(<IWaitingRoomMessage>{
          action: WaitingRoomAction.setDeck,
          data: deck!.id,
        }),
      );

      const message = JSON.parse(
        await waitForSocketMessage(session1),
      ) as IWaitingRoomServerMessage;

      const waitingRoomAfter = await WaitingRoom.findById(waitingRoom._id);
      expect(message.action).toBe(WaitingRoomServerAction.setDeck);
      expect(message.data).toBe(deck!.id);
    });
    test("Invalid deck", async () => {
      session1.send(
        JSON.stringify(<IWaitingRoomMessage>{
          action: WaitingRoomAction.setDeck,
          data: "invalid",
        }),
      );

      const message = JSON.parse(
        await waitForSocketMessage(session1),
      ) as IWaitingRoomServerMessage;

      const waitingRoomAfter = await WaitingRoom.findById(waitingRoom._id);
      expect(message.action).toBe(WaitingRoomServerAction.error);
      expect(message.data).toBe(WaitingRoomError.invalidData);
      expect(waitingRoomAfter!.deck).toBeUndefined();
    });
    test("Deck does not exist", async () => {
      session1.send(
        JSON.stringify(<IWaitingRoomMessage>{
          action: WaitingRoomAction.setDeck,
          data: "55332820baf6ae736adf6c80",
        }),
      );

      const message = JSON.parse(
        await waitForSocketMessage(session1),
      ) as IWaitingRoomServerMessage;

      const waitingRoomAfter = await WaitingRoom.findById(waitingRoom._id);
      expect(message.action).toBe(WaitingRoomServerAction.error);
      expect(message.data).toBe(WaitingRoomError.invalidData);
      expect(waitingRoomAfter!.deck).toBeUndefined();
    });
  });

  test("Correct game start", async () => {
    const gamesBefore = await Game.find().countDocuments();
    const cardDeck = await CardDeck.findOne();

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
      await waitForSocketMessage(session1),
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
    session1.send(
      JSON.stringify({
        action: WaitingRoomAction.start,
      } as IWaitingRoomMessage),
    );
    const message = JSON.parse(
      await waitForSocketMessage(session1),
    ) as IWaitingRoomServerMessage;

    expect(message.action).toBe(WaitingRoomServerAction.error);
    expect(message.data).toBe(WaitingRoomError.notReady);
  });
  test("Incorrect game start, no players", async () => {
    session2.close();
    await waitForSocketMessage(session1);

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
  test("Incorrect game start, no deck", async () => {
    session1.send(
      JSON.stringify({
        action: WaitingRoomAction.ready,
        data: true,
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

    session1.send(
      JSON.stringify({
        action: WaitingRoomAction.start,
      } as IWaitingRoomMessage),
    );
    const message = JSON.parse(
      await waitForSocketMessage(session1),
    ) as IWaitingRoomServerMessage;

    expect(message.data).toBe(WaitingRoomError.noDeck);
  });
  test("Incorrect game start, wrong host", async () => {
    session1.send(
      JSON.stringify({
        action: WaitingRoomAction.ready,
        data: true,
      } as IWaitingRoomMessage),
    );
    await waitForSocketMessage(session2);
    session2.send(
      JSON.stringify({
        action: WaitingRoomAction.ready,
        data: true,
      } as IWaitingRoomMessage),
    );
    await waitForSocketMessage(session2);

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
    session1.close();
    await waitForSocketMessage(session2);
    const ownerPromotionMessage = JSON.parse(
      await waitForSocketMessage(session2),
    ) as IWaitingRoomServerMessage;

    const waitingRoomAfter = await WaitingRoom.findById(
      waitingRoom._id,
    ).populate<{
      host: IUser;
    }>("host");

    expect(ownerPromotionMessage.action).toBe(WaitingRoomServerAction.newHost);
    expect(waitingRoom?.host).not.toBe(waitingRoomAfter?.host);
  });

  test("All users exit", async () => {
    session1.close();
    session2.close();

    const promise = new Promise<void>((resolve) => {
      const interval = setInterval(async () => {
        const waitingRoomAfter = await WaitingRoom.findById(waitingRoom._id);
        if (waitingRoomAfter == null) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });

    expect(promise).resolves.toBeUndefined();
  });
});
