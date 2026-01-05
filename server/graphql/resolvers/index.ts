import { bookResolvers } from "./books";
import { chunkResolvers } from "./chunks";
import { progressResolvers } from "./progress";
import { sessionResolvers } from "./session";
import { quizResolvers } from "./quizzes";
import { eq, desc } from "drizzle-orm";
import { bookSections, quizAttempts } from "../../../db/schema";

export const resolvers = {
  Query: {
    ...bookResolvers.Query,
    ...chunkResolvers.Query,
    ...progressResolvers.Query,
    ...quizResolvers.Query,
  },
  Mutation: {
    ...sessionResolvers.Mutation,
    ...progressResolvers.Mutation,
    ...quizResolvers.Mutation,
  },
  // Type resolvers
  Book: {
    sections: async (parent: any, _: any, context: any) => {
      if (parent.sections) {
        return parent.sections; // Already loaded via include
      }
      return context.db.query.bookSections.findMany({
        where: eq(bookSections.bookId, parent.id),
        orderBy: (sections, { asc }) => [asc(sections.sectionIndex)],
      });
    },
  },
  Quiz: {
    attempts: async (parent: any, _: any, context: any) => {
      return context.db.query.quizAttempts.findMany({
        where: eq(quizAttempts.quizId, parent.id),
        orderBy: (attempts, { desc }) => [desc(attempts.answeredAt)],
      });
    },
  },
  Chunk: {
    id: (parent: any) => {
      return String(parent.id); // Convert BigInt to String
    },
  },
};

