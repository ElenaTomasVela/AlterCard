import { treaty } from "@elysiajs/eden";
import { app } from "../src";
import mongoose from "mongoose";
import { encryptUser, User } from "../src/models/user";
import { seedCards } from "../src/seeders/seedCards";
import { getCookieFromResponse } from "./utils";
import { beforeAll } from "bun:test";

export const api = treaty(app);

export const users = [
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

let token1: string;
let token2: string;
let token3: string;

beforeAll(async () => {
  await mongoose.connection.dropDatabase();
  const encryptedUsers = await Promise.all(users.map((u) => encryptUser(u)));
  await User.insertMany(encryptedUsers);
  seedCards();

  const { response: response1 } = await api.user.login.post(users[0]);
  const { response: response2 } = await api.user.login.post(users[1]);
  const { response: response3 } = await api.user.login.post(users[2]);
  token1 = getCookieFromResponse(response1)["authorization"];
  token2 = getCookieFromResponse(response2)["authorization"];
  token3 = getCookieFromResponse(response3)["authorization"];
});

export { token1, token2, token3 };
