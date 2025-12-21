import type { GraphQLContext } from "../context";

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

      return context.prisma.readingProgress.findUnique({
        where: {
          sessionId_bookId: {
            sessionId: context.sessionId,
            bookId,
          },
        },
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

      return context.prisma.readingProgress.upsert({
        where: {
          sessionId_bookId: {
            sessionId: context.sessionId,
            bookId: input.bookId,
          },
        },
        create: {
          sessionId: context.sessionId,
          bookId: input.bookId,
          currentChunkIndex: input.currentChunkIndex,
          unlockedUntilChunkIndex: input.unlockedUntilChunkIndex,
        },
        update: {
          currentChunkIndex: input.currentChunkIndex,
          unlockedUntilChunkIndex: input.unlockedUntilChunkIndex,
        },
      });
    },
  },
};

