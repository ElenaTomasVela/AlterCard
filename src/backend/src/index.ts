import swagger from "@elysiajs/swagger";
import { Elysia } from "elysia";
import mongoose from "mongoose";

mongoose
  .connect(
    `mongodb://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_URL}/${process.env.DB_NAME}?authSource=admin&w=1`,
  )
  .then(() => console.log("Connected to MongoDB"))
  .catch((e) => console.log(e));

export const app = new Elysia()
  .use(swagger())
  .get("/user", () => "Hello Elysia!!!")
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
