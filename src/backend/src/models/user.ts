import { t, Elysia } from "elysia";
import mongoose from "mongoose";
const bcrypt = require("bcrypt");

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

export const encryptUser = async (user: IUser) => {
  const encryptedPassword = await bcrypt.hash(user.password, 10);

  const encryptedUser = new User({ ...user, password: encryptedPassword });

  return encryptedUser;
};

export const checkCredentials = async (user: IUser) => {
  const dbUser = await User.findOne({ username: user.username });
  if (!dbUser) return false;

  const isPasswordCorrect = await bcrypt.compare(
    user.password,
    dbUser?.password,
  );

  return isPasswordCorrect;
};
