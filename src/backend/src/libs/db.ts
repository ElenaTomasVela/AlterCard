import mongoose from "mongoose";

export const connectDB = () => {
  mongoose
    .connect(process.env.DB_URL)
    .then(() => console.log("Connected to MongoDB"))
    .catch((e) => console.log(e));
};

export const resetDB = () => {};
