import type { GraphQLContext } from "../context";

export const bookResolvers = {
  Query: {
    books: async (_: any, __: any, context: GraphQLContext) => {
      if (!context.sessionId) {
        return [];
      }

      const sessionBooks = await context.prisma.sessionBook.findMany({
        where: { sessionId: context.sessionId },
        include: { book: true },
      });

      return sessionBooks.map((sb: { book: any }) => sb.book);
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

