import { beforeAll, describe, expect, test } from "bun:test";
import { app } from "../src";
import { treaty } from "@elysiajs/eden";
import mongoose from "mongoose";
import { User } from "../src/models/user";

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
  await User.insertMany(users);
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

  test("Incorrect sign-up", async () => {});
});

describe("Room", () => {
  test("Authenticated room creation", async () => {
    const { data: token, status: loginStatus } = await api.user.login.post(
      users[1],
    );

    const { status } = await api.room.index.post(
      {},
      { headers: { authorization: `Bearer ${token}` } },
    );

    expect(loginStatus).toBe(200);
    expect(status).toBe(200);
  });
  test("Unauthenticated room creation", async () => {
    const { status } = await api.room.index.post({});

    expect(status).toBe(401);
  });

  test.skip("Authenticated room join", async () => {});
  test.skip("Unauthenticated room join", async () => {});
  test.skip("Incorrect room join", async () => {});

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
