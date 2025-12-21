import { graphqlMutation, CREATE_QUIZ } from "./useGraphQL";

export type McqQuestion = {
  id: string;
  question: string;
  choices: {
    A: string;
    B: string;
    C: string;
  };
  correct_choice: "A" | "B" | "C";
  fact_ids: string[];
  evidence: Array<{ fact_id: string; quote: string }>;
};

export type GenerateQuizResponse = {
  mcq: {
    questions: McqQuestion[];
  };
  nextState?: any; // ReaderState - not returned from GraphQL, stored in DB
};

export const useQuizGenerator = () => {
  const generateQuiz = async (args: {
    bookId: string;
    gateStartChunkIndex: number;
    gateEndChunkIndex: number;
  }): Promise<GenerateQuizResponse> => {
    try {
      const response = await graphqlMutation<{ createQuiz: any }>(CREATE_QUIZ, {
        input: {
          bookId: args.bookId,
          gateStartChunkIndex: args.gateStartChunkIndex,
          gateEndChunkIndex: args.gateEndChunkIndex,
        },
      });

      // Transform GraphQL response to expected format
      const quiz = response.createQuiz;
      const questions = (quiz.questions as any).questions || [];

      return {
        mcq: {
          questions,
        },
      };
    } catch (error) {
      console.error("Quiz generation GraphQL error:", error);
      throw error;
    }
  };

  return {
    generateQuiz,
  };
};

