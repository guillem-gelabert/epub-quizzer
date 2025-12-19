import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const BOOKS_DIR = path.join(process.cwd(), ".books");

export default defineEventHandler(async (event) => {
  const bookId = getRouterParam(event, "id");
  const body = await readBody(event);

  if (!bookId) {
    throw createError({
      statusCode: 400,
      message: "Book ID is required",
    });
  }

  const bookDir = path.join(BOOKS_DIR, bookId);
  if (!existsSync(bookDir)) {
    await mkdir(bookDir, { recursive: true });
  }

  const dataPath = path.join(bookDir, "data.json");
  await writeFile(dataPath, JSON.stringify(body, null, 2));

  return { success: true };
});

