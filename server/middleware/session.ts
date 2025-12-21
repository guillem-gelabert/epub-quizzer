import { prisma } from "../utils/prisma";
import { randomUUID } from "node:crypto";

export default defineEventHandler(async (event) => {
  // #region agent log
  console.log('[DEBUG] Session middleware:', {
    path: event.path,
    method: event.method
  });
  // #endregion
  
  // Check for existing session cookie
  const cookies = parseCookies(event);
  let sessionId = cookies.sid;

  try {
    if (!sessionId) {
      // Create new session
      const session = await prisma.session.create({
        data: {
          userAgentHash: (event.headers.get("user-agent") || event.headers.get("User-Agent"))?.substring(0, 50) || null,
          locale: (event.headers.get("accept-language") || event.headers.get("Accept-Language"))?.split(",")[0] || null,
        },
      });
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
        await prisma.session.update({
          where: { id: sessionId },
          data: { lastSeenAt: new Date() },
        });
      } catch (error) {
        // Session might not exist, create new one
        const session = await prisma.session.create({
          data: {
            id: sessionId,
            userAgentHash: (event.headers.get("user-agent") || event.headers.get("User-Agent"))?.substring(0, 50) || null,
            locale: (event.headers.get("accept-language") || event.headers.get("Accept-Language"))?.split(",")[0] || null,
          },
        });
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
  
  // #region agent log
  console.log('[DEBUG] Session middleware complete:', {
    sessionId: sessionId?.substring(0, 8) + '...',
    hasContext: !!event.context.sessionId
  });
  // #endregion
});

