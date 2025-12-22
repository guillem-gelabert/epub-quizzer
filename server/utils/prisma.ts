import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create adapter for Prisma 7
const adapter = new PrismaPg(pool);

// Prisma 7 with adapter - use type assertion to work around type checking
// The adapter is passed but PrismaClient types don't fully support it yet
export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  (new (PrismaClient as any)({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  }) as PrismaClient);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
