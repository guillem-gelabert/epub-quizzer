import type { GraphQLContext } from "../context";

// #region agent log
const LOG_ENDPOINT = "http://127.0.0.1:7245/ingest/2fc64e3d-fe57-477f-9bb1-fd781caa27df";
const LOG_FILE = "/Users/guillem/projects/guillem/epub-quizzer/.cursor/debug.log";
const log = async (hypothesisId: string, location: string, message: string, data: any) => {
  const entry = JSON.stringify({
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    location,
    message,
    data,
    sessionId: "debug-session",
    runId: "server-debug",
    hypothesisId,
  }) + "\n";
  try {
    await fetch(LOG_ENDPOINT, {method: "POST", headers: {"Content-Type": "application/json"}, body: entry.trim()}).catch(()=>{});
  } catch {}
  try {
    const fs = await import("node:fs/promises");
    await fs.appendFile(LOG_FILE, entry).catch(()=>{});
  } catch {}
  console.error(`[DEBUG ${hypothesisId}] ${location}: ${message}`, data);
};
// #endregion

export const bookResolvers = {
  Query: {
    books: async (_: any, __: any, context: GraphQLContext) => {
      // #region agent log
      await log("A", "books.ts:books:entry", "books query entry", { hasSessionId: !!context.sessionId, sessionId: context.sessionId });
      // #endregion
      
      if (!context.sessionId) {
        // #region agent log
        await log("A", "books.ts:books:no-session", "no sessionId, returning empty", {});
        // #endregion
        return [];
      }

      try {
        // #region agent log
        await log("B", "books.ts:books:before-query", "before prisma query", { sessionId: context.sessionId });
        // #endregion
        
        const sessionBooks = await context.prisma.sessionBook.findMany({
          where: { sessionId: context.sessionId },
          include: { book: true },
        });

        // #region agent log
        await log("B", "books.ts:books:after-query", "after prisma query", { count: sessionBooks.length, bookIds: sessionBooks.map((sb: any) => sb.book?.id) });
        // #endregion

        const result = sessionBooks.map((sb: { book: any }) => sb.book);
        
        // #region agent log
        await log("B", "books.ts:books:exit", "books query exit", { resultCount: result.length });
        // #endregion
        
        return result;
      } catch (error) {
        // #region agent log
        await log("B", "books.ts:books:error", "prisma query error", { 
          error: error instanceof Error ? error.message : String(error),
          errorName: error instanceof Error ? error.name : typeof error,
          stack: error instanceof Error ? error.stack?.substring(0, 500) : undefined
        });
        // #endregion
        throw error;
      }
    },

    book: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      return context.prisma.book.findUnique({
        where: { id },
        include: {
          sections: {
            orderBy: { sectionIndex: "asc" },
          },
        },
      });
    },

    bookToc: async (_: any, { bookId }: { bookId: string }, context: GraphQLContext) => {
      const book = await context.prisma.book.findUnique({
        where: { id: bookId },
        select: { toc: true },
      });

      return book?.toc || null;
    },
  },
};
