import { jwt } from "@elysiajs/jwt";
import { Server } from "bun";
import swagger from "@elysiajs/swagger";
import { bearer } from "@elysiajs/bearer";
import { Elysia, NotFoundError, t } from "elysia";
import mongoose from "mongoose";
import { User, checkCredentials, encryptUser, tUser } from "./models/user";
import cors from "@elysiajs/cors";
import { WaitingRoom } from "./models/waitingRoom";
import { connectDB } from "./libs/db";
import { Game, gameFromWaitingRoom } from "./models/game";

// Typescript needs to know that the env variables are defined
declare module "bun" {
  interface Env {
    JWT_SECRET: string;
    DB_URL: string;
  }
}

class AuthError extends Error {
  constructor(message: string) {
    super(message);
  }
}

connectDB();

let serverInstance: Server | undefined | null;
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
  .error("UNAUTHORIZED", AuthError)
  .onError(({ code, error, set }) => {
    switch (code) {
      case "VALIDATION":
        set.status = 400;
        break;
      case "UNAUTHORIZED":
        set.status = 401;
        break;
      case "NOT_FOUND":
        set.status = 404;
        break;
      default:
        set.status = 500;
        break;
    }
    return error.message;
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
        async ({ body, jwtauth, error, cookie: { authentication } }) => {
          const userId = await checkCredentials(body);

          if (userId) {
            const token = await jwtauth.sign({
              username: body.username,
              id: userId,
            });
            authentication.set({ value: token, httpOnly: true, secure: true });
            return token;
          } else {
            return error(400, "Invalid credentials");
          }
        },
        { body: "user" },
      );
  })
  .resolve(async ({ jwtauth, bearer }) => {
    const user = await jwtauth.verify(bearer);
    if (!user) throw new AuthError("Unauthorized");

    return { user };
  })
  .group("/room", (app) => {
    return app
      .get("/", async () => {
        return await WaitingRoom.find().populate("host", "username");
      })
      .post("/", async ({ user }) => {
        const waitingRoom = new WaitingRoom({
          host: user.id,
          players: [user.id],
        });
        await waitingRoom.save();

        return waitingRoom.id;
      })
      .get("/:id", async ({ params }) => {
        return await WaitingRoom.findById(params.id)
          .populate("host", "username")
          .populate("users", "username");
      })
      .ws("/:id/ws", {
        params: t.Object({ id: t.String() }),
        body: t.Union([t.Literal("start")]),
        async beforeHandle({ params }) {
          const waitingRoom = await WaitingRoom.findById(params.id);
          if (!waitingRoom) throw new NotFoundError();
        },
        async open(ws) {
          ws.subscribe(ws.data.params.id);
          ws.publish(ws.data.params.id, "playerJoined");
          const waitingRoom = await WaitingRoom.findById(ws.data.params.id);
          if (
            !waitingRoom!.users.includes(
              new mongoose.Types.ObjectId(ws.data.user.id),
            )
          ) {
            await WaitingRoom.findByIdAndUpdate(ws.data.params.id, {
              $push: { users: ws.data.user.id },
            });
          }
          ws.send("success");
        },
        close(ws) {
          serverInstance?.publish(ws.data.params.id, "playerLeft");
          ws.unsubscribe(ws.data.params.id);
        },
        async message(ws, message) {
          switch (message) {
            case "start":
              const waitingRoom = await WaitingRoom.findById(ws.data.params.id);
              if (waitingRoom!.host.toString() !== ws.data.user.id) {
                const game = gameFromWaitingRoom(waitingRoom!);
                await game.save();

                app.server?.publish(ws.data.params.id, "gameStarted");
              } else {
                throw new Error("Only the host can start the game");
              }
              break;
            default:
              break;
          }
        },
      });
  })
  .listen(3000);

serverInstance = app.server;

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
