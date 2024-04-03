import mongoose from "mongoose";
import { IUser, User } from "./models/user";

const users: IUser[] = [
  {
    username: "user1",
    password: "pass1",
  },
  {
    username: "user2",
    password: "pass2",
  },
  {
    username: "user3",
    password: "pass3",
  },
];

await mongoose
  .connect(process.env.DB_URL)
  .then(() => console.log("Connected to DB"))
  .catch((err) => console.log(err));

await mongoose.connection.dropDatabase();
console.log("Dropped DB");

await User.insertMany(users)
  .then(() => console.log("Added users"))
  .catch((err) => console.log(err));

mongoose.connection.close();
