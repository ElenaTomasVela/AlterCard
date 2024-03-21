import { Elysia } from "elysia";
import mongoose from "mongoose";

mongoose
  .connect(
    // `mongodb://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_URL}/${process.env.DB_NAME}`,
    `mongodb://${process.env.DB_URL}/${process.env.DB_NAME}`,
  )
  .then(() => console.log("Connected to MongoDB"))
  .catch((e) => console.log(e));

const app = new Elysia().get("/", () => "Hello Elysia!!!").listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
