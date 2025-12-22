import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";

// #region agent log
const LOG_ENDPOINT = "http://127.0.0.1:7245/ingest/2fc64e3d-fe57-477f-9bb1-fd781caa27df";
const LOG_FILE = "/Users/guillem/projects/guillem/epub-quizzer/.cursor/debug.log";
const log = async (h: string, l: string, m: string, d: any) => {
  const entry = JSON.stringify({id: `log_${Date.now()}_${Math.random().toString(36).substr(2,9)}`, timestamp: Date.now(), location: l, message: m, data: d, sessionId: "debug-session", runId: "server-debug", hypothesisId: h}) + "\n";
  try {
    await fetch(LOG_ENDPOINT, {method: "POST", headers: {"Content-Type": "application/json"}, body: entry.trim()}).catch(()=>{});
  } catch {}
  try {
    const fs = await import("node:fs/promises");
    await fs.appendFile(LOG_FILE, entry).catch(()=>{});
  } catch {}
  console.error(`[DEBUG ${h}] ${l}: ${m}`, d);
};
// #endregion

const prismaClientSingleton = () => {
  // #region agent log
  log("B", "prisma.ts:prismaClientSingleton:entry", "creating prisma client", {
    hasDbUrl: !!process.env.DATABASE_URL,
    dbUrlLength: process.env.DATABASE_URL?.length,
    dbUrlPreview: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 50) + "..." : undefined,
    nodeEnv: process.env.NODE_ENV,
    cwd: process.cwd()
  });
  // #endregion
  
  if (!process.env.DATABASE_URL) {
    // #region agent log
    log("B", "prisma.ts:prismaClientSingleton:no-db-url", "DATABASE_URL missing", {});
    // #endregion
    throw new Error("DATABASE_URL environment variable is not set");
  }
  
  try {
    // #region agent log
    log("B", "prisma.ts:prismaClientSingleton:before-pool", "before creating PrismaPg pool", {connectionStringLength: process.env.DATABASE_URL.length});
    // #endregion
    
    const pool = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    
    // #region agent log
    log("B", "prisma.ts:prismaClientSingleton:after-pool", "after creating PrismaPg pool", {poolCreated: !!pool, poolType: typeof pool});
    // #endregion
    
    // #region agent log
    log("B", "prisma.ts:prismaClientSingleton:before-client", "before creating PrismaClient", {hasAdapter: !!pool});
    // #endregion
    
    const client = new PrismaClient({ adapter: pool });
    
    // #region agent log
    log("B", "prisma.ts:prismaClientSingleton:after-client", "after creating PrismaClient", {clientCreated: !!client, clientType: typeof client});
    // #endregion
    
    return client;
  } catch (error) {
    // #region agent log
    log("B", "prisma.ts:prismaClientSingleton:error", "prisma client creation error", {
      error: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : typeof error,
      stack: error instanceof Error ? error.stack?.substring(0, 1000) : undefined,
      errorString: String(error)
    });
    // #endregion
    throw error;
  }
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

// #region agent log
log("B", "prisma.ts:module-init", "prisma module initialization", {hasGlobalPrisma: !!globalForPrisma.prisma, nodeEnv: process.env.NODE_ENV});
// #endregion

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// #region agent log
log("B", "prisma.ts:module-exit", "prisma module export", {prismaExported: !!prisma});
// #endregion
