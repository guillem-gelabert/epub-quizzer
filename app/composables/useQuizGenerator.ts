import type { Chunk, ReaderState } from "./useOpenAi";

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
  nextState: ReaderState;
};

export const useQuizGenerator = () => {
  const generateQuiz = async (args: {
    state: ReaderState;
    windowChunks: Chunk[];
    questionCount: 1 | 2 | 3 | 4;
    model?: string;
    chapterNumber?: string;
    paragraphIndex?: number;
    questionNumber?: number;
  }): Promise<GenerateQuizResponse> => {
    try {
      const response = await $fetch<GenerateQuizResponse>("/api/quiz/generate", {
        method: "POST",
        body: args,
        timeout: 60000, // 60 second timeout
      });

      return response;
    } catch (error) {
      console.error("Quiz generation API error:", error);
      throw error;
    }
  };

  return {
    generateQuiz,
  };
};

