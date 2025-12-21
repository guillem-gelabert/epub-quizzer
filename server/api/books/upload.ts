import crypto from "node:crypto";
import { prisma } from "../../utils/prisma";
import {
  parseEpubMetadata,
  extractToc,
  parseAllSections,
  extractCover,
} from "../../utils/epubParser";
import { chunkHtml } from "../../utils/chunking";

export default defineEventHandler(async (event) => {
  const formData = await readFormData(event);
  const file = formData.get("file") as File;

  if (!file || !file.name.endsWith(".epub")) {
    throw createError({
      statusCode: 400,
      message: "Invalid file. Expected EPUB file.",
    });
  }

  // Get session ID from context (set by middleware)
  const sessionId = event.context.sessionId;
  if (!sessionId) {
    throw createError({
      statusCode: 401,
      message: "Session required",
    });
  }

  // Calculate content hash
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentHash = crypto.createHash("sha256").update(buffer).digest("hex");

  // Check if book already exists
  let book = await prisma.book.findUnique({
    where: { contentHash },
  });

  if (book) {
    // Book exists, just link it to session if not already linked
    await prisma.sessionBook.upsert({
      where: {
        sessionId_bookId: {
          sessionId,
          bookId: book.id,
        },
      },
      create: {
        sessionId,
        bookId: book.id,
      },
      update: {},
    });

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
  book = await prisma.book.create({
    data: {
      contentHash,
      title: metadata.title,
      author: metadata.author,
      toc: toc as any, // Store TOC as JSONB
    },
  });

  // Extract and save cover image
  const coverPath = await extractCover(buffer, book.id);
  if (coverPath) {
    book = await prisma.book.update({
      where: { id: book.id },
      data: { coverPath },
    });
  }

  // Create sections and precompute chunks
  let globalChunkIndex = 0;

  for (const section of sections) {
    // Create book section
    const bookSection = await prisma.bookSection.create({
      data: {
        bookId: book.id,
        sectionIndex: section.sectionIndex,
        href: section.href,
        title: section.title,
        html: section.html,
        plainText: section.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      },
    });

    // Precompute chunks for this section
    const chunks = chunkHtml(section.html, section.sectionIndex);

    // Create chunk records
    for (const chunk of chunks) {
      await prisma.chunk.create({
        data: {
          bookId: book.id,
          chunkIndex: globalChunkIndex++,
          sectionId: bookSection.id,
          sectionIndex: section.sectionIndex,
          text: chunk.text,
          wordCount: chunk.wordCount,
          sourceHint: chunk.sourceHint as any,
        },
      });
    }
  }

  // Link book to session
  await prisma.sessionBook.create({
    data: {
      sessionId,
      bookId: book.id,
    },
  });

  return {
    bookId: book.id,
    filename: file.name,
    isNew: true,
  };
});

