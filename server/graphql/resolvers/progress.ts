import type { GraphQLContext } from "../context";
import { eq, and } from "drizzle-orm";
import { readingProgress } from "../../../db/schema";

export const progressResolvers = {
  Query: {
    progress: async (
      _: any,
      { bookId }: { bookId: string },
      context: GraphQLContext
    ) => {
      if (!context.sessionId) {
        return null;
      }

      return context.db.query.readingProgress.findFirst({
        where: and(
          eq(readingProgress.sessionId, context.sessionId),
          eq(readingProgress.bookId, bookId)
        ),
      });
    },
  },

  Mutation: {
    updateProgress: async (
      _: any,
      {
        input,
      }: {
        input: {
          bookId: string;
          currentChunkIndex: number;
          unlockedUntilChunkIndex: number;
        };
      },
      context: GraphQLContext
    ) => {
      if (!context.sessionId) {
        throw new Error("Session required");
      }

      // Check if exists
      const existing = await context.db.query.readingProgress.findFirst({
        where: and(
          eq(readingProgress.sessionId, context.sessionId),
          eq(readingProgress.bookId, input.bookId)
        ),
      });

      if (existing) {
        // Update
        const [updated] = await context.db
          .update(readingProgress)
          .set({
            currentChunkIndex: input.currentChunkIndex,
            unlockedUntilChunkIndex: input.unlockedUntilChunkIndex,
            updatedAt: new Date(),
          })
          .where(and(
            eq(readingProgress.sessionId, context.sessionId),
            eq(readingProgress.bookId, input.bookId)
          ))
          .returning();
        return updated;
      }

      // Create
      const [created] = await context.db.insert(readingProgress).values({
        sessionId: context.sessionId,
        bookId: input.bookId,
        currentChunkIndex: input.currentChunkIndex,
        unlockedUntilChunkIndex: input.unlockedUntilChunkIndex,
      }).returning();
      return created;
    },
  },
};

