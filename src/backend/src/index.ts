import { jwt } from "@elysiajs/jwt";
import { Server } from "bun";
import swagger from "@elysiajs/swagger";
import { Elysia, NotFoundError, ValidationError, t } from "elysia";
import { User, checkCredentials, encryptUser, tUser } from "./models/user";
import cors from "@elysiajs/cors";
import { WaitingRoom } from "./models/waitingRoom";
import { connectDB } from "./libs/db";
import { Game, GameAction, gameFromWaitingRoom } from "./models/game";
import { houseRule } from "./models/houseRule";
import { CardColor } from "./models/card";
import mongoose from "mongoose";

// Typescript needs to know that the env variables are defined
declare module "bun" {
  interface Env {
    JWT_SECRET: string;
    DB_URL: string;
    FRONTEND_URL: string;
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
  .use(
    cors({
      credentials: true,
      origin: process.env.FRONTEND_URL,
      allowedHeaders: "Content-Type",
    }),
  )
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
        async ({ jwtauth, body, cookie: { authorization } }) => {
          const user = await encryptUser(body);
          await user.save();

          const token = await jwtauth.sign({
            username: user.username,
            id: user.id,
          });
          authorization.set({ value: token, sameSite: "none", path: "/" });
          return "success";
        },
        { body: "user" },
      )
      .post(
        "/login",
        async ({ body, jwtauth, error, cookie: { authorization } }) => {
          const userId = await checkCredentials(body);
          if (userId) {
            const token = await jwtauth.sign({
              username: body.username,
              id: userId,
            });
            authorization.set({ value: token, sameSite: "none", path: "/" });
            return "success";
          } else {
            return error(400, "Invalid credentials");
          }
        },
        { body: "user" },
      );
  })
  .resolve(async ({ jwtauth, cookie: { authorization } }) => {
    const user = await jwtauth.verify(authorization.value);
    if (!user) throw new AuthError("Unauthorized");
    const dbUser = User.findById(user.id);
    if (!dbUser) throw new NotFoundError("User not found");

    return { user };
  })
  .group("/room", (app) => {
    return app
      .get("/", async () => {
        return await WaitingRoom.find().populate("host", "username");
      })
      .post("/", async ({ user }) => {
        const waitingRoom = new WaitingRoom({
          host: new mongoose.Types.ObjectId(user.id),
          users: [{ user: new mongoose.Types.ObjectId(user.id) }],
        });
        await waitingRoom.save();
        return waitingRoom.id;
      })
      .get("/:id", async ({ params }) => {
        const room = await WaitingRoom.findById(params.id)
          .populate("host", "username")
          .populate("users.user", "username")
          .lean();
        return room;
      })
      .ws("/:id/ws", {
        params: t.Object({ id: t.String() }),
        body: t.Object({
          action: t.Union([
            t.Literal("start"),
            t.Literal("addRule"),
            t.Literal("removeRule"),
            t.Literal("ready"),
          ]),
          data: t.Optional(t.Union([t.String(), t.Boolean()])),
        }),
        async beforeHandle({ params }) {
          const waitingRoom = await WaitingRoom.findById(params.id);
          if (!waitingRoom) throw new NotFoundError();
        },
        async open(ws) {
          ws.subscribe(ws.data.params.id);
          const waitingRoom = await WaitingRoom.findById(ws.data.params.id);
          if (
            !waitingRoom!.users.some(
              (u) => u.user.toString() === ws.data.user.id,
            )
          ) {
            await WaitingRoom.findByIdAndUpdate(ws.data.params.id, {
              $push: { users: { user: ws.data.user.id } },
            });
            serverInstance?.publish(
              ws.data.params.id,
              JSON.stringify({
                action: "playerJoined",
                data: ws.data.user.username,
              }),
            );
          }
        },
        async close(ws) {
          const updated = await WaitingRoom.findByIdAndUpdate(
            ws.data.params.id,
            {
              $pull: { users: { user: ws.data.user.id } },
            },
            { new: true },
          );
          serverInstance?.publish(
            ws.data.params.id,
            JSON.stringify({
              action: "playerLeft",
              data: ws.data.user.username,
            }),
          );
          ws.unsubscribe(ws.data.params.id);
          if (updated && updated.users.length == 0) {
            await WaitingRoom.findByIdAndDelete(ws.data.params.id);
          }
        },
        async message(ws, message) {
          const waitingRoom = await WaitingRoom.findById(ws.data.params.id);
          try {
            switch (message.action) {
              case "start":
                if (waitingRoom!.host.toString() != ws.data.user.id)
                  throw new Error("Only the host can start the game");

                const game = gameFromWaitingRoom(waitingRoom!);
                await game.save();

                serverInstance?.publish(
                  ws.data.params.id,
                  JSON.stringify({
                    action: "gameStarted",
                    data: game.id,
                  }),
                );

                break;
              case "addRule":
                if (waitingRoom!.host.toString() !== ws.data.user.id)
                  throw new Error("Only the host can add rules");
                if (
                  !message.data ||
                  typeof message.data !== "string" ||
                  !(Object.values(houseRule) as string[]).includes(message.data)
                )
                  throw new ValidationError(
                    "message.data",
                    t.Enum(houseRule),
                    message.data,
                  );
                if (!waitingRoom!.houseRules.includes(message.data)) {
                  waitingRoom!.houseRules.push(message.data);
                  await waitingRoom!.save();

                  ws.publish(
                    ws.data.params.id,
                    JSON.stringify({
                      action: "addRule",
                      data: message.data,
                    }),
                  );
                }
                break;
              case "removeRule":
                if (waitingRoom!.host.toString() !== ws.data.user.id)
                  throw new Error("Only the host can remove rules");
                if (
                  !message.data ||
                  typeof message.data !== "string" ||
                  !(Object.values(houseRule) as string[]).includes(message.data)
                )
                  throw new ValidationError(
                    "message.data",
                    t.Enum(houseRule),
                    message.data,
                  );
                if (waitingRoom!.houseRules.includes(message.data)) {
                  await WaitingRoom.findByIdAndUpdate(ws.data.params.id, {
                    $pull: { houseRules: message.data },
                  });

                  ws.publish(
                    ws.data.params.id,
                    JSON.stringify({
                      action: "removeRule",
                      data: message.data,
                    }),
                  );
                }
                break;
              case "ready":
                if (typeof message.data !== "boolean")
                  throw new ValidationError(
                    "message.data",
                    t.Boolean(),
                    message.data,
                  );
                await WaitingRoom.findOneAndUpdate(
                  {
                    _id: waitingRoom!._id,
                    "users.user": ws.data.user.id,
                  },
                  { $set: { "users.$.ready": message.data } },
                );
                ws.publish(
                  ws.data.params.id,
                  JSON.stringify({
                    action: "ready",
                    data: message.data,
                    user: ws.data.user.username,
                  }),
                );
                break;
              default:
                break;
            }
          } catch (e) {
            ws.send(e.message);
          }
        },
      });
  })
  .group("/game", (app) =>
    app
      .get("/:id", async ({ params: { id } }) => {
        const game = await Game.findById(id)
          .populate("discardPile")
          .populate("drawPile")
          .populate({
            path: "players",
            populate: { path: "user", select: "username" },
          })
          .populate({
            path: "players",
            populate: { path: "user", select: "username" },
          })
          .lean();
        return game;
      })
      .ws("/:id/ws", {
        body: t.Object({
          action: t.Enum(GameAction),
          data: t.Optional(
            t.Union([t.String(), t.Number(), t.Enum(CardColor)]),
          ),
        }),
        message(ws, message) {
          switch (message.action) {
            case GameAction.draw:
              break;
            case GameAction.play:
              break;
            case GameAction.lastCard:
              break;
            case GameAction.accuse:
              break;
            case GameAction.chooseColor:
              break;
            default:
              break;
          }
        },
      }),
  )
  .listen(3000);

serverInstance = app.server;

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
