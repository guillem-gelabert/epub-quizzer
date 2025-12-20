import { writeFile, readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const BOOKS_DIR = path.join(process.cwd(), ".books");

export default defineEventHandler(async (event) => {
  const bookId = getRouterParam(event, "id");

  if (!bookId) {
    throw createError({
      statusCode: 400,
      message: "Book ID is required",
    });
  }

  const body = await readBody(event);
  const { chapterHref, gateIndex, questions, answers } = body;

  if (!chapterHref || gateIndex === undefined || !questions || !answers) {
    throw createError({
      statusCode: 400,
      message: "Missing required fields: chapterHref, gateIndex, questions, answers",
    });
  }

  const bookDir = path.join(BOOKS_DIR, bookId);
  const quizDataPath = path.join(bookDir, "quiz-data.json");

  // Ensure book directory exists
  if (!existsSync(bookDir)) {
    await mkdir(bookDir, { recursive: true });
  }

  // Load existing quiz data or create new
  let quizData: Record<string, any> = {};
  if (existsSync(quizDataPath)) {
    try {
      const existingData = await readFile(quizDataPath, "utf8");
      quizData = JSON.parse(existingData);
    } catch (error) {
      console.error("Error reading existing quiz data:", error);
      quizData = {};
    }
  }

  // Update or create entry for this chapter
  if (!quizData[chapterHref]) {
    quizData[chapterHref] = {};
  }

  // Update gate data
  const gateKey = `gate_${gateIndex}`;
  if (!quizData[chapterHref][gateKey]) {
    quizData[chapterHref][gateKey] = {
      gateIndex,
      questions: [],
      answers: {},
      timestamp: new Date().toISOString(),
    };
  }

  quizData[chapterHref][gateKey].questions = questions;
  quizData[chapterHref][gateKey].answers = answers;
  quizData[chapterHref][gateKey].lastUpdated = new Date().toISOString();

  // Save updated quiz data
  await writeFile(quizDataPath, JSON.stringify(quizData, null, 2), "utf8");

  return { success: true };
});

