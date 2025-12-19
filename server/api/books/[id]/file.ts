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
  const epubPath = path.join(bookDir, "book.epub");

  if (!existsSync(epubPath)) {
    throw createError({
      statusCode: 404,
      message: "Book file not found",
    });
  }

  const fileBuffer = await readFile(epubPath);
  
  setHeader(event, "Content-Type", "application/epub+zip");
  
  return fileBuffer;
});

