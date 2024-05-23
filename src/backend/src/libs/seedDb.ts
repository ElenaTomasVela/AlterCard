import mongoose from "mongoose";
import { connectDB } from "./db";
import { seedCards } from "../seeders/seedCards";

await connectDB();

await mongoose.connection.dropDatabase();
console.log("Dropped DB");

await seedCards();
console.log("Seeded DB");

mongoose.connection.close();
