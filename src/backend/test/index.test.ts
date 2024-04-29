import { beforeAll, describe, expect, test } from "bun:test";
import { app } from "../src";
import { treaty } from "@elysiajs/eden";
import mongoose from "mongoose";
import { User, encryptUser } from "../src/models/user";
import { WaitingRoom } from "../src/models/waitingRoom";
import { waitForSocketConnection, waitForSocketMessage } from "./utils";

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

beforeAll(async () => {
  await mongoose.connection.dropDatabase();
  const encryptedUsers = await Promise.all(users.map((u) => encryptUser(u)));
  await User.insertMany(encryptedUsers);
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
  test("Authenticated room creation", async () => {
    const { data: token, status: loginStatus } = await api.user.login.post(
      users[1],
    );

    const previousRoomCount = (await WaitingRoom.find()).length;
    const { status, data: roomId } = await api.room.index.post(
      {},
      { headers: { authorization: `Bearer ${token}` } },
    );
    const currentRoomCount = (await WaitingRoom.find()).length;

    expect(loginStatus).toBe(200);
    expect(status).toBe(200);
    expect(roomId).toBeString;
    expect(currentRoomCount).toBe(previousRoomCount + 1);
  });
  test("Unauthenticated room creation", async () => {
    const { status } = await api.room.index.post({});

    expect(status).toBe(401);
  });

  test("Authenticated room join", async () => {
    const waitingRoomBefore = await WaitingRoom.findOne();
    const roomId = waitingRoomBefore!.id;
    const { data: token } = await api.user.login.post(users[1]);

    // Eden Treaty has a buggy websocket implementation, so Bun's is
    // being used instead, at the cost of type safety
    const session = new WebSocket(`ws://localhost:3000/room/${roomId}/ws`, {
      // @ts-expect-error
      headers: { Authorization: `Bearer ${token}` },
    });

    let messages: string[] = [];
    session.addEventListener("open", () => messages.push("open"));
    await waitForSocketConnection(session);
    await waitForSocketMessage(session);

    const waitingRoomAfter = await WaitingRoom.findById(roomId);

    expect(messages).toStrictEqual(["open"]);
    expect(waitingRoomAfter!.users.length).toBe(
      waitingRoomBefore!.users.length + 1,
    );
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

  test.skip("Player ready", async () => {});
  test.skip("Player not ready", async () => {});

  test.skip("Correct game start", async () => {});
  test.skip("Incorrect game start, not ready", async () => {});
  test.skip("Incorrect game start, no players", async () => {});
  test.skip("Incorrect game start, wrong host", async () => {});

  test.skip("User exit", async () => {});
  test.skip("Host exit", async () => {});
  test.skip("All users exit", async () => {});

  test.skip("House rule toggle", async () => {});
  test.skip("Game start with house rule", async () => {});
});

describe("Game", () => {
  test.skip("Correct card distribution", async () => {});
  test.skip("Draw when starting turn", async () => {});
  test.skip("Game end when 1 player remaining", async () => {});

  test.skip("Correct play", async () => {});
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
