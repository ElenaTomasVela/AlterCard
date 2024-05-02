import { jwt } from "@elysiajs/jwt";
import { Server } from "bun";
import swagger from "@elysiajs/swagger";
import { Elysia, NotFoundError, ValidationError, t } from "elysia";
import { checkCredentials, encryptUser, tUser } from "./models/user";
import cors from "@elysiajs/cors";
import { WaitingRoom } from "./models/waitingRoom";
import { connectDB } from "./libs/db";
import { gameFromWaitingRoom } from "./models/game";
import { houseRule } from "./models/houseRule";

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
        async ({ body, jwtauth, error, cookie: { authorization } }) => {
          const userId = await checkCredentials(body);
          if (userId) {
            const token = await jwtauth.sign({
              username: body.username,
              id: userId,
            });
            authorization.set({ value: token, sameSite: true, path: "/" });
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
          users: [{ user: user.id }],
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
          data: t.Optional(t.String()),
        }),
        async beforeHandle({ params }) {
          const waitingRoom = await WaitingRoom.findById(params.id);
          if (!waitingRoom) throw new NotFoundError();
        },
        async open(ws) {
          ws.subscribe(ws.data.params.id);
          ws.publish(
            ws.data.params.id,
            JSON.stringify({
              action: "playerJoined",
              data: ws.data.user.username,
            }),
          );
          const waitingRoom = await WaitingRoom.findById(ws.data.params.id);
          if (
            !waitingRoom!.users.some(
              (u) => u.user.toString() === ws.data.user.id,
            )
          ) {
            await WaitingRoom.findByIdAndUpdate(ws.data.params.id, {
              $push: { users: { user: ws.data.user.id } },
            });
          }
          ws.send("success");
        },
        async close(ws) {
          serverInstance?.publish(
            ws.data.params.id,
            JSON.stringify({
              action: "playerLeft",
              data: ws.data.user.username,
            }),
          );
          ws.unsubscribe(ws.data.params.id);
          await WaitingRoom.findByIdAndUpdate(ws.data.params.id, {
            $pull: { users: ws.data.user.id },
          });
        },
        async message(ws, message) {
          const waitingRoom = await WaitingRoom.findById(ws.data.params.id);
          switch (message.action) {
            case "start":
              if (waitingRoom!.host.toString() !== ws.data.user.id) {
                const game = gameFromWaitingRoom(waitingRoom!);
                await game.save();

                serverInstance?.publish(
                  ws.data.params.id,
                  JSON.stringify({
                    action: "gameStarted",
                  }),
                );
              } else {
                throw new Error("Only the host can start the game");
              }
              break;
            case "addRule":
              if (waitingRoom!.host.toString() !== ws.data.user.id)
                throw new Error("Only the host can add rules");
              if (!message.data || !(message.data in houseRule))
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
                    action: "houseRuleAdded",
                    data: message.data,
                  }),
                );
              }
              break;
            case "removeRule":
              if (waitingRoom!.host.toString() !== ws.data.user.id)
                throw new Error("Only the host can add rules");
              if (!message.data || !(message.data in houseRule))
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
                    action: "houseRuleRemoved",
                    data: message.data,
                  }),
                );
              }
              break;
            case "ready":
              if (
                !message.data ||
                (message.data !== "true" && message.data !== "false")
              )
                throw new ValidationError(
                  "message.data",
                  t.Union([t.Literal("true"), t.Literal("false")]),
                  message.data,
                );
              const parsedReady = message.data === "true";
              await WaitingRoom.findByIdAndUpdate(
                ws.data.params.id,
                {
                  _id: waitingRoom!._id,
                  "users.user": ws.data.user.id,
                },
                { $set: { "users.$.ready": parsedReady } },
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
        },
      });
  })
  .listen(3000);

serverInstance = app.server;

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
