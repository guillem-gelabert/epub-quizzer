import { bookResolvers } from "./books";
import { chunkResolvers } from "./chunks";
import { progressResolvers } from "./progress";
import { sessionResolvers } from "./session";
import { quizResolvers } from "./quizzes";

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
      return context.prisma.bookSection.findMany({
        where: { bookId: parent.id },
        orderBy: { sectionIndex: "asc" },
      });
    },
  },
  Quiz: {
    attempts: async (parent: any, _: any, context: any) => {
      return context.prisma.quizAttempt.findMany({
        where: { quizId: parent.id },
        orderBy: { answeredAt: "desc" },
      });
    },
  },
  Chunk: {
    id: (parent: any) => {
      return String(parent.id); // Convert BigInt to String
    },
  },
};

