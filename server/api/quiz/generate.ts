import {
  QuizPipeline,
  type Chunk,
  type ReaderState,
} from "~/composables/useOpenAi";
import path from "node:path";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const {
    state,
    windowChunks,
    questionCount,
    model,
    chapterNumber,
    paragraphIndex,
    questionNumber,
  } = body;

  if (!state || !windowChunks || !questionCount) {
    throw createError({
      statusCode: 400,
      message: "Missing required fields: state, windowChunks, questionCount",
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw createError({
      statusCode: 500,
      message: "OPENAI_API_KEY not configured",
    });
  }

  const promptsDir = path.join(process.cwd(), "prompts");

  try {
    // Verify prompts directory exists
    const { existsSync } = await import("node:fs");
    if (!existsSync(promptsDir)) {
      throw new Error(`Prompts directory not found: ${promptsDir}`);
    }

    // Verify prompt files exist
    const { readFile } = await import("node:fs/promises");
    const requiredFiles = [
      "step1.system.md",
      "step1.user.md",
      "step2.system.md",
      "step2.user.md",
    ];
    for (const file of requiredFiles) {
      const filePath = path.join(promptsDir, file);
      if (!existsSync(filePath)) {
        throw new Error(`Required prompt file not found: ${filePath}`);
      }
      // Try to read it to verify it's accessible
      await readFile(filePath, "utf8");
    }

    const pipeline = new QuizPipeline({
      apiKey,
      promptsDir,
    });

    console.log("Starting quiz generation with", windowChunks.length, "chunks");
    const result = await pipeline.generateGateQuiz({
      state: state as ReaderState,
      windowChunks: windowChunks as Chunk[],
      questionCount: questionCount as 1 | 2 | 3 | 4,
      model: model || "gpt-5.2",
      chapterNumber: chapterNumber as string | undefined,
      paragraphIndex: paragraphIndex as number | undefined,
      questionNumber: questionNumber as number | undefined,
    });

    console.log(
      "Quiz generation successful, returning",
      result.mcq.questions.length,
      "questions"
    );
    return {
      mcq: result.mcq,
      nextState: result.nextState,
    };
  } catch (error) {
    console.error("Quiz generation error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("Error stack:", errorStack);
    throw createError({
      statusCode: 500,
      message: `Failed to generate quiz: ${errorMessage}`,
      data: errorStack,
    });
  }
});
