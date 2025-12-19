import { readFile } from "node:fs/promises";
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

  const bookDir = path.join(BOOKS_DIR, bookId);
  const dataPath = path.join(bookDir, "data.json");

  if (!existsSync(dataPath)) {
    throw createError({
      statusCode: 404,
      message: "Book data not found",
    });
  }

  const data = await readFile(dataPath, "utf8");
  return JSON.parse(data);
});

