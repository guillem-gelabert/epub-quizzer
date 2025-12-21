import type { H3Event } from "h3";
import { prisma } from "../utils/prisma";

export interface GraphQLContext {
  prisma: typeof prisma;
  sessionId: string | null;
  event: H3Event;
}

export async function createContext(event: H3Event): Promise<GraphQLContext> {
  // Session ID should be set by middleware
  const sessionId = event.context.sessionId || null;

  return {
    prisma,
    sessionId,
    event,
  };
}

