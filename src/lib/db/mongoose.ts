import mongoose from "mongoose";

declare global {
  var __mongooseConn: typeof mongoose | undefined;
}

let cached = globalThis.__mongooseConn;

export async function connectMongo() {
  if (cached) return cached;

  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) throw new Error("MONGODB_URI is not set");

  cached = await mongoose.connect(MONGODB_URI);
  globalThis.__mongooseConn = cached;
  return cached;
}

export default mongoose;
