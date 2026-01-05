import type { GraphQLContext } from "../context";
import { eq, gte, asc } from "drizzle-orm";
import { chunks } from "../../../db/schema";

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
      return context.db.query.chunks.findMany({
        where: and(
          eq(chunks.bookId, bookId),
          gte(chunks.chunkIndex, from)
        ),
        orderBy: (chunks, { asc }) => [asc(chunks.chunkIndex)],
        limit,
      });
    },
  },
};

