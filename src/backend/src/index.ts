import { jwt } from "@elysiajs/jwt";
import swagger from "@elysiajs/swagger";
import { bearer } from "@elysiajs/bearer";
import { Elysia, t } from "elysia";
import mongoose from "mongoose";
import { User, checkCredentials, encryptUser, tUser } from "./models/user";
import cors from "@elysiajs/cors";
import { WaitingRoom } from "./models/waitingRoom";

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
      schema: t.Object({
        username: t.String(),
        id: t.String(),
      }),
    }),
  )
  .use(cors())
  .use(bearer())
  .onError(({ code, error }) => {
    console.log(error);
    return new Response(error.toString());
  })
  .group("/user", (app) => {
    return app
      .post(
        "/",
        async ({ jwtauth, body }) => {
          const user = await encryptUser(body);
          await user.save();

          const token = await jwtauth.sign({
            username: user.username,
            id: user.id,
          });
          return token;
        },
        { body: "user" },
      )
      .post(
        "/login",
        async ({ body, jwtauth, error }) => {
          const userId = await checkCredentials(body);

          if (userId) {
            const token = await jwtauth.sign({
              username: body.username,
              id: userId,
            });
            return token;
          } else {
            return error(400, "Invalid credentials");
          }
        },
        { body: "user" },
      );
  })
  .guard(
    {
      beforeHandle: async ({ error, jwtauth, bearer }) => {
        const user = await jwtauth.verify(bearer);

        if (!user) {
          return error(401, "Unauthorized");
        }
      },
    },
    (app) =>
      app
        .resolve(async ({ jwtauth, bearer }) => {
          const user = await jwtauth.verify(bearer);
          if (!user) throw new Error("Unauthorized");

          return { user };
        })
        .group("/room", (app) => {
          return app
            .post("/", async ({ user }) => {
              const waitingRoom = new WaitingRoom({
                host: user.id,
                players: [user.id],
              });
              await waitingRoom.save();

              return waitingRoom.id;
            })
            .get("/:id", async ({ params: { id } }) => {
              return "Joined room " + id;
            });
        }),
  )
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
