import { db } from "../utils/db";
import { randomUUID } from "node:crypto";
import { sessions } from "../../db/schema";
import { eq } from "drizzle-orm";

export default defineEventHandler(async (event) => {
  // Check for existing session cookie
  const cookies = parseCookies(event);
  let sessionId = cookies.sid;

  try {
    if (!sessionId) {
      // Create new session
      const [session] = await db.insert(sessions).values({
        userAgentHash: (event.headers.get("user-agent") || event.headers.get("User-Agent"))?.substring(0, 50) || null,
        locale: (event.headers.get("accept-language") || event.headers.get("Accept-Language"))?.split(",")[0] || null,
      }).returning();
      sessionId = session.id;

      // Set cookie (expires in 1 year)
      setCookie(event, "sid", sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365, // 1 year
        path: "/",
      });
    } else {
      // Update last seen
      try {
        await db.update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.id, sessionId));
      } catch (error) {
        // Session might not exist, create new one
        const [session] = await db.insert(sessions).values({
          id: sessionId,
          userAgentHash: (event.headers.get("user-agent") || event.headers.get("User-Agent"))?.substring(0, 50) || null,
          locale: (event.headers.get("accept-language") || event.headers.get("Accept-Language"))?.split(",")[0] || null,
        }).returning();
        sessionId = session.id;
      }
    }
  } catch (error) {
    // If database is not available, generate a temporary session ID
    // This allows the app to start even if DB isn't ready
    console.warn("Database not available, using temporary session:", error);
    if (!sessionId) {
      sessionId = randomUUID();
      setCookie(event, "sid", sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
      });
    }
  }

  // Attach session ID to event context
  event.context.sessionId = sessionId;
});

