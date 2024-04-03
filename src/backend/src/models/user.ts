import { t, Elysia } from "elysia";
import mongoose from "mongoose";

export interface IUser {
  username: string;
  password: string;
}

export const tUser = new Elysia().model({
  user: t.Object({
    username: t.String(),
    password: t.String(),
  }),
});

const UserSchema = new mongoose.Schema<IUser>({
  username: {
    type: String,
    required: true,
    unique: true,
    index: true,
    maxlength: 50,
  },
  password: {
    type: String,
    required: true,
    maxlength: 100,
  },
});

export const User = mongoose.model("User", UserSchema);
