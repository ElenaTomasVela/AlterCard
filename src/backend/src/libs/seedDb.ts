import mongoose from "mongoose";
import { connectDB } from "./db";
import { seedCards } from "../seeders/seedCards";

connectDB();

await mongoose.connection.dropDatabase();
console.log("Dropped DB");

seedCards();

mongoose.connection.close();
