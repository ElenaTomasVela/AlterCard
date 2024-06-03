import mongoose from "mongoose";
import { connectDB } from "./db";
import { seedCards } from "../seeders/seedCards";

await connectDB();

await seedCards();
console.log("Seeded DB");

mongoose.connection.close();
