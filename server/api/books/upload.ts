import crypto from "node:crypto";
import { db } from "../../utils/db";
import { eq } from "drizzle-orm";
import { books, bookSections, chunks } from "../../../db/schema";
import {
  parseEpubMetadata,
  extractToc,
  parseAllSections,
  extractCover,
} from "../../utils/epubParser";
import { chunkHtml } from "../../utils/chunking";

export default defineEventHandler(async (event) => {
  // Validate API key
  const apiKey = event.headers.get("x-api-key") || event.headers.get("X-API-Key");
  const expectedApiKey = process.env.API_KEY;

  if (!expectedApiKey) {
    throw createError({
      statusCode: 500,
      message: "API key not configured on server",
    });
  }

  if (!apiKey || apiKey !== expectedApiKey) {
    throw createError({
      statusCode: 401,
      message: "Invalid or missing API key",
    });
  }

  const formData = await readFormData(event);
  const file = formData.get("file") as File;

  if (!file || !file.name.endsWith(".epub")) {
    throw createError({
      statusCode: 400,
      message: "Invalid file. Expected EPUB file.",
    });
  }

  // Calculate content hash
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentHash = crypto.createHash("sha256").update(buffer).digest("hex");

  // Check if book already exists
  let book = await db.query.books.findFirst({
    where: eq(books.contentHash, contentHash),
  });

  if (book) {
    // Book already exists, return it
    return {
      bookId: book.id,
      filename: file.name,
      isNew: false,
    };
  }

  // Parse EPUB
  const metadata = await parseEpubMetadata(buffer);
  const toc = await extractToc(buffer);
  const sections = await parseAllSections(buffer);

  // Create book in database (we'll update coverPath after extraction)
  const [newBook] = await db.insert(books).values({
    contentHash,
    title: metadata.title,
    author: metadata.author,
    toc: toc as any, // Store TOC as JSONB
  }).returning();
  book = newBook;

  // Extract and save cover image
  const coverPath = await extractCover(buffer, book.id);
  if (coverPath) {
    const [updatedBook] = await db.update(books)
      .set({ coverPath })
      .where(eq(books.id, book.id))
      .returning();
    book = updatedBook;
  }

  // Create sections and precompute chunks
  let globalChunkIndex = 0;

  for (const section of sections) {
    // Create book section
    const [bookSection] = await db.insert(bookSections).values({
      bookId: book.id,
      sectionIndex: section.sectionIndex,
      href: section.href,
      title: section.title,
      html: section.html,
      plainText: section.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    }).returning();

    // Precompute chunks for this section
    const chunkData = chunkHtml(section.html, section.sectionIndex);

    // Create chunk records
    if (chunkData.length > 0) {
      await db.insert(chunks).values(
        chunkData.map((chunk) => ({
          bookId: book.id,
          chunkIndex: globalChunkIndex++,
          sectionId: bookSection.id,
          sectionIndex: section.sectionIndex,
          text: chunk.text,
          wordCount: chunk.wordCount,
          sourceHint: chunk.sourceHint as any,
        }))
      );
    }
  }

  return {
    bookId: book.id,
    filename: file.name,
    isNew: true,
  };
});

