import { jwt } from "@elysiajs/jwt";
import swagger from "@elysiajs/swagger";
import { Elysia, t } from "elysia";
import mongoose from "mongoose";
import { User, tUser } from "./models/user";

// Typescript needs to know that the env variables are defined
declare module "bun" {
  interface Env {
    JWT_SECRET: string;
    DB_URL: string;
  }
}

mongoose
  .connect(process.env.DB_URL)
  .then(() => console.log("Connected to MongoDB"))
  .catch((e) => console.log(e));

export const app = new Elysia()
  .use(tUser)
  .use(swagger())
  .use(
    jwt({
      name: "jwtauth",
      secret: process.env.JWT_SECRET,
    }),
  )
  .group("/user", (app) => {
    return app
      .post(
        "/",
        async ({ jwtauth, body }) => {
          const user = new User(body);
          await user.save();

          const token = await jwtauth.sign({ username: user.username });

          return token;
        },
        { body: "user" },
      )
      .post(
        "/login",
        async ({ body, jwtauth, error }) => {
          const user = await User.findOne({ username: body.username });
          if (body.password == user?.password) {
            const token = await jwtauth.sign({ username: user.username });
            return token;
          } else {
            return error(400, "Invalid credentials");
          }
        },
        { body: "user" },
      );
  })

  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
