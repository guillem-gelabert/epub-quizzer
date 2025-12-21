import type { GraphQLContext } from "../context";

export const sessionResolvers = {
  Mutation: {
    createSession: async (_: any, __: any, context: GraphQLContext) => {
      // Session should already be created by middleware
      if (!context.sessionId) {
        throw new Error("Session creation failed");
      }

      const session = await context.prisma.session.findUnique({
        where: { id: context.sessionId },
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

      return context.prisma.sessionBook.upsert({
        where: {
          sessionId_bookId: {
            sessionId: context.sessionId,
            bookId,
          },
        },
        create: {
          sessionId: context.sessionId,
          bookId,
        },
        update: {},
        include: {
          session: true,
          book: true,
        },
      });
    },
  },
};

