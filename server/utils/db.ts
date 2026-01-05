import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../../db/schema";

const drizzleClientSingleton = () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  try {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const db = drizzle(pool, { schema });
    return db;
  } catch (error) {
    throw error;
  }
};

type DrizzleClientSingleton = ReturnType<typeof drizzleClientSingleton>;

const globalForDb = globalThis as unknown as {
  db: DrizzleClientSingleton | undefined;
};

export const db = globalForDb.db ?? drizzleClientSingleton();

if (process.env.NODE_ENV !== "production") globalForDb.db = db;
