import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const BOOKS_DIR = path.join(process.cwd(), ".books");

export default defineEventHandler(async (event) => {
  const formData = await readFormData(event);
  const file = formData.get("file") as File;

  if (!file || !file.name.endsWith(".epub")) {
    throw createError({
      statusCode: 400,
      message: "Invalid file. Expected EPUB file.",
    });
  }

  // Create books directory if it doesn't exist
  if (!existsSync(BOOKS_DIR)) {
    await mkdir(BOOKS_DIR, { recursive: true });
  }

  // Generate unique book ID from file content hash
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");
  const bookId = hash.substring(0, 16);

  const bookDir = path.join(BOOKS_DIR, bookId);
  if (!existsSync(bookDir)) {
    await mkdir(bookDir, { recursive: true });
  }

  // Save EPUB file
  const epubPath = path.join(bookDir, "book.epub");
  await writeFile(epubPath, buffer);

  return {
    bookId,
    filename: file.name,
  };
});

