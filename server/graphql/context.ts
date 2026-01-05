import type { H3Event } from "h3";
import { db } from "../utils/db";

export interface GraphQLContext {
  db: typeof db;
  sessionId: string | null;
  event: H3Event;
}

export async function createContext(event: H3Event): Promise<GraphQLContext> {
  // Session ID should be set by middleware
  const sessionId = event.context.sessionId || null;

  return {
    db,
    sessionId,
    event,
  };
}
