import { t, Elysia } from "elysia";
import mongoose from "mongoose";

export interface IUser {
  username: string;
  password: string;
}

export interface IPopulatedUser {
  username: string;
}

export const tUser = new Elysia().model({
  user: t.Object({
    username: t.String({ maxLength: 50 }),
    password: t.String({ maxLength: 100 }),
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
  const encryptedPassword = await Bun.password.hash(user.password, {
    algorithm: "bcrypt",
  });

  const encryptedUser = new User({ ...user, password: encryptedPassword });

  return encryptedUser;
};

export const checkCredentials = async (user: IUser) => {
  const dbUser = await User.findOne({ username: user.username });
  if (!dbUser) return false;

  const isPasswordCorrect = await Bun.password.verify(
    user.password,
    dbUser?.password,
  );

  return isPasswordCorrect && dbUser._id.toString();
};
