import mongoose from "mongoose";

export const connectDB = () => {
  const promise = new Promise<void>((resolve) => {
    mongoose
      .connect(process.env.DB_URL)
      .then(() => {
        console.log("Connected to MongoDB");
        resolve();
      })
      .catch((e) => console.log(e));
  });
  return promise;
};

export const resetDB = () => {};
