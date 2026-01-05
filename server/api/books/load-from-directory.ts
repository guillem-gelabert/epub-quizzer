import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import crypto from "node:crypto";
import { db } from "../../utils/db";
import { eq, and } from "drizzle-orm";
import { books, sessionBooks, bookSections, chunks, sessions } from "../../../db/schema";
import {
  parseEpubMetadata,
  extractToc,
  parseAllSections,
  extractCover,
} from "../../utils/epubParser";
import { chunkHtml } from "../../utils/chunking";

export default defineEventHandler(async (event) => {
  // Get session ID from context (set by middleware)
  let sessionId = event.context.sessionId;

  if (!sessionId) {
    throw createError({
      statusCode: 401,
      message: "Session required",
    });
  }

  // Ensure session exists in database (might have been created as temporary)
  const existingSession = await db.query.sessions.findFirst({
    where: eq(sessions.id, sessionId),
  });
  
  if (!existingSession) {
    // Create session if it doesn't exist
    const [newSession] = await db.insert(sessions).values({
      id: sessionId,
      userAgentHash: (event.headers.get("user-agent") || event.headers.get("User-Agent"))?.substring(0, 50) || null,
      locale: (event.headers.get("accept-language") || event.headers.get("Accept-Language"))?.split(",")[0] || null,
    }).returning();
    sessionId = newSession.id;
  }

  const booksDir = join(process.cwd(), ".books");

  // Check if .books directory exists
  if (!existsSync(booksDir)) {
    return {
      message: ".books directory not found",
      loaded: [],
      errors: [],
    };
  }

  // Read all files in .books directory
  const files = await readdir(booksDir);
  const epubFiles = files.filter((file) => file.endsWith(".epub"));

  if (epubFiles.length === 0) {
    return {
      message: "No EPUB files found in .books directory",
      loaded: [],
      errors: [],
    };
  }

  // Process each EPUB file
  for (const filename of epubFiles) {
    try {
      const filePath = join(booksDir, filename);
      await stat(filePath);

      // Read file
      const buffer = await readFile(filePath);

      // Calculate content hash
      const contentHash = crypto.createHash("sha256").update(buffer).digest("hex");

      // Check if book already exists
      let book = await db.query.books.findFirst({
        where: eq(books.contentHash, contentHash),
      });

      if (book) {
        // Book exists, just link it to session if not already linked
        const existing = await db.query.sessionBooks.findFirst({
          where: and(
            eq(sessionBooks.sessionId, sessionId),
            eq(sessionBooks.bookId, book.id)
          ),
        });
        
        if (!existing) {
          await db.insert(sessionBooks).values({
            sessionId,
            bookId: book.id,
          });
        }

        loaded.push({
          bookId: book.id,
          filename,
          isNew: false,
        });
        continue;
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

      // Link book to session
      await db.insert(sessionBooks).values({
        sessionId,
        bookId: book.id,
      });

      loaded.push({
        bookId: book.id,
        filename,
        isNew: true,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push({
        filename,
        error: errorMessage,
      });
      console.error(`Failed to load book ${filename}:`, error);
    }
  }

  return {
    message: `Processed ${epubFiles.length} EPUB file(s)`,
    loaded,
    errors,
  };
});
