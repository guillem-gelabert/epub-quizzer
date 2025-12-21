import type { GraphQLContext } from "../context";
import {
  QuizPipeline,
  type Chunk as PipelineChunk,
  type ReaderState,
} from "../../../app/composables/useOpenAi";
import path from "node:path";

export const quizResolvers = {
  Query: {
    quizzes: async (
      _: any,
      { bookId }: { bookId: string },
      context: GraphQLContext
    ) => {
      if (!context.sessionId) {
        return [];
      }

      return context.prisma.quiz.findMany({
        where: {
          sessionId: context.sessionId,
          bookId,
        },
        orderBy: { gateStartChunkIndex: "asc" },
      });
    },

    quiz: async (_: any, { id }: { id: string }, context: GraphQLContext) => {
      return context.prisma.quiz.findUnique({
        where: { id },
      });
    },
  },

  Mutation: {
    createQuiz: async (
      _: any,
      {
        input,
      }: {
        input: {
          bookId: string;
          gateStartChunkIndex: number;
          gateEndChunkIndex: number;
        };
      },
      context: GraphQLContext
    ) => {
      if (!context.sessionId) {
        throw new Error("Session required");
      }

      // Check if quiz already exists
      const existingQuiz = await context.prisma.quiz.findFirst({
        where: {
          sessionId: context.sessionId,
          bookId: input.bookId,
          gateStartChunkIndex: input.gateStartChunkIndex,
          gateEndChunkIndex: input.gateEndChunkIndex,
        },
      });

      if (existingQuiz) {
        return existingQuiz;
      }

      // Fetch chunks for the gate window
      const chunks = await context.prisma.chunk.findMany({
        where: {
          bookId: input.bookId,
          chunkIndex: {
            gte: input.gateStartChunkIndex,
            lte: input.gateEndChunkIndex,
          },
        },
        orderBy: { chunkIndex: "asc" },
      });

      if (chunks.length === 0) {
        throw new Error("No chunks found for gate window");
      }

      // Convert to PipelineChunk format
      const windowChunks: PipelineChunk[] = chunks.map((chunk: { chunkIndex: number; text: string }, index: number) => ({
        id: `chunk-${chunk.chunkIndex}`,
        text: chunk.text,
      }));

      // Get or create reading progress to get reader state
      const progress = await context.prisma.readingProgress.findUnique({
        where: {
          sessionId_bookId: {
            sessionId: context.sessionId,
            bookId: input.bookId,
          },
        },
      });

      // Build reader state (simplified - you may want to store this in DB)
      const state: ReaderState = {
        section_title: "",
        entities: [],
        prior_summary: progress ? `Read up to chunk ${progress.currentChunkIndex}` : "",
      };

      // Calculate question count based on word count
      const totalWords = chunks.reduce((sum: number, chunk: { wordCount: number }) => sum + chunk.wordCount, 0);
      let questionCount: 1 | 2 | 3 | 4 = 1;
      if (totalWords >= 400) {
        questionCount = 4;
      } else if (totalWords >= 300) {
        questionCount = 3;
      } else if (totalWords >= 200) {
        questionCount = 2;
      }

      // Generate quiz using OpenAI
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY not configured");
      }

      const promptsDir = path.join(process.cwd(), "prompts");
      const pipeline = new QuizPipeline({
        apiKey,
        promptsDir,
      });

      const result = await pipeline.generateGateQuiz({
        state,
        windowChunks,
        questionCount,
        model: "gpt-4o-mini",
      });

      // Store quiz in database
      const quiz = await context.prisma.quiz.create({
        data: {
          sessionId: context.sessionId,
          bookId: input.bookId,
          gateStartChunkIndex: input.gateStartChunkIndex,
          gateEndChunkIndex: input.gateEndChunkIndex,
          facts: result.facts as any,
          questions: result.mcq as any,
        },
      });

      return quiz;
    },

    submitQuizAttempt: async (
      _: any,
      {
        input,
      }: {
        input: {
          quizId: string;
          answers: Record<string, string>;
        };
      },
      context: GraphQLContext
    ) => {
      // Get quiz to check correct answers
      const quiz = await context.prisma.quiz.findUnique({
        where: { id: input.quizId },
      });

      if (!quiz) {
        throw new Error("Quiz not found");
      }

      // Parse questions from JSONB
      const questions = (quiz.questions as any).questions || [];
      let correctCount = 0;

      // Check answers
      for (const question of questions) {
        const userAnswer = input.answers[question.id];
        if (userAnswer === question.correct_choice) {
          correctCount++;
        }
      }

      const passed = correctCount === questions.length;

      // Create attempt
      const attempt = await context.prisma.quizAttempt.create({
        data: {
          quizId: input.quizId,
          answers: input.answers as any,
          correctCount,
          passed,
        },
      });

      return attempt;
    },
  },
};

