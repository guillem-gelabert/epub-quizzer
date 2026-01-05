import type { GraphQLContext } from "../context";
import { eq, and } from "drizzle-orm";
import { sessionBooks, books, bookSections } from "../../../db/schema";

export const bookResolvers = {
  Query: {
    books: async (_: any, __: any, context: GraphQLContext) => {
      if (!context.sessionId) {
        return [];
      }

      try {
        const sessionBooksData = await context.db
          .select({
            book: books,
          })
          .from(sessionBooks)
          .innerJoin(books, eq(sessionBooks.bookId, books.id))
          .where(eq(sessionBooks.sessionId, context.sessionId));

        const result = sessionBooksData.map((sb) => sb.book);
        
        return result;
      } catch (error) {
        throw error;
      }
    },

    book: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      const book = await context.db.query.books.findFirst({
        where: eq(books.id, id),
        with: {
          sections: {
            orderBy: (sections, { asc }) => [asc(sections.sectionIndex)],
          },
        },
      });
      return book;
    },

    bookToc: async (_: any, { bookId }: { bookId: string }, context: GraphQLContext) => {
      const book = await context.db.query.books.findFirst({
        where: eq(books.id, bookId),
        columns: { toc: true },
      });

      return book?.toc || null;
    },
  },
};
