import type { GraphQLContext } from "../context";

export const chunkResolvers = {
  Query: {
    chunks: async (
      _: any,
      {
        bookId,
        from = 0,
        limit = 100,
      }: { bookId: string; from?: number; limit?: number },
      context: GraphQLContext
    ) => {
      return context.prisma.chunk.findMany({
        where: {
          bookId,
          chunkIndex: {
            gte: from,
          },
        },
        orderBy: { chunkIndex: "asc" },
        take: limit,
      });
    },
  },
};

