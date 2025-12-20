import { readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const BOOKS_DIR = path.join(process.cwd(), ".books");

export default defineEventHandler(async (event) => {
  if (!existsSync(BOOKS_DIR)) {
    return [];
  }

  try {
    const entries = await readdir(BOOKS_DIR, { withFileTypes: true });
    const bookIds = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    return bookIds;
  } catch (error) {
    console.error("Error listing books:", error);
    return [];
  }
});

