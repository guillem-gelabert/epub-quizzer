import type { GraphQLContext } from "../context";
import { eq, and } from "drizzle-orm";
import { sessions, sessionBooks, books } from "../../../db/schema";

export const sessionResolvers = {
  Mutation: {
    createSession: async (_: any, __: any, context: GraphQLContext) => {
      // Session should already be created by middleware
      if (!context.sessionId) {
        throw new Error("Session creation failed");
      }

      const session = await context.db.query.sessions.findFirst({
        where: eq(sessions.id, context.sessionId),
      });

      if (!session) {
        throw new Error("Session not found");
      }

      return session;
    },

    addBookToSession: async (
      _: any,
      { bookId }: { bookId: string },
      context: GraphQLContext
    ) => {
      if (!context.sessionId) {
        throw new Error("Session required");
      }

      // Check if exists
      const existing = await context.db.query.sessionBooks.findFirst({
        where: and(
          eq(sessionBooks.sessionId, context.sessionId),
          eq(sessionBooks.bookId, bookId)
        ),
      });

      if (existing) {
        // Return with relations
        const [sessionBook] = await context.db
          .select()
          .from(sessionBooks)
          .innerJoin(sessions, eq(sessionBooks.sessionId, sessions.id))
          .innerJoin(books, eq(sessionBooks.bookId, books.id))
          .where(and(
            eq(sessionBooks.sessionId, context.sessionId),
            eq(sessionBooks.bookId, bookId)
          ))
          .limit(1);
        return { ...sessionBook.sessionBooks, session: sessionBook.sessions, book: sessionBook.books };
      }

      // Create new
      const [newSessionBook] = await context.db.insert(sessionBooks).values({
        sessionId: context.sessionId,
        bookId,
      }).returning();

      // Fetch with relations
      const [result] = await context.db
        .select()
        .from(sessionBooks)
        .innerJoin(sessions, eq(sessionBooks.sessionId, sessions.id))
        .innerJoin(books, eq(sessionBooks.bookId, books.id))
        .where(and(
          eq(sessionBooks.sessionId, context.sessionId),
          eq(sessionBooks.bookId, bookId)
        ))
        .limit(1);
      
      return { ...result.sessionBooks, session: result.sessions, book: result.books };
    },
  },
};

