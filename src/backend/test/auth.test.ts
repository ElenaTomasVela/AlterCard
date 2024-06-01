import { describe, test, expect } from "bun:test";
import { User } from "../src/models/user";
import { api, users } from "./setup";

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
