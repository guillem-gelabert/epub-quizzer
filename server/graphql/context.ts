import type { H3Event } from "h3";
import { prisma } from "../utils/prisma";
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


export interface GraphQLContext {
  prisma: typeof prisma;
  sessionId: string | null;
  event: H3Event;
}

export async function createContext(event: H3Event): Promise<GraphQLContext> {
  // #region agent log
  await log("A", "context.ts:createContext:entry", "creating GraphQL context", {hasPrisma: !!prisma});
  // #endregion
  try {
    // #region agent log
    await log("A", "context.ts:createContext:prisma-check", "checking prisma client", {prismaType: typeof prisma, prismaKeys: prisma && typeof prisma === 'object' ? Object.keys(prisma).slice(0, 5) : []});
    // #endregion
    
    // Session ID should be set by middleware
    const sessionId = event.context.sessionId || null;
    // #region agent log
    await log("A", "context.ts:createContext:session", "sessionId from context", {hasSessionId: !!sessionId, sessionId});
    // #endregion

    // #region agent log
    await log("A", "context.ts:createContext:exit", "context created", {hasSessionId: !!sessionId, hasPrisma: !!prisma});
    // #endregion

    return {
      prisma,
      sessionId,
      event,
    };
  } catch (error) {
    // #region agent log
    await log("A", "context.ts:createContext:error", "context creation error", {error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined});
    // #endregion
    throw error;
  }
}

