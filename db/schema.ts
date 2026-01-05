import { pgTable, uuid, text, timestamp, integer, jsonb, bigint, boolean, uniqueIndex, index, primaryKey } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
  userAgentHash: text("user_agent_hash"),
  locale: text("locale"),
});

export const books = pgTable("books", {
  id: uuid("id").primaryKey().defaultRandom(),
  contentHash: text("content_hash").notNull().unique(),
  title: text("title").notNull(),
  author: text("author").notNull(),
  toc: jsonb("toc"),
  coverPath: text("cover_path"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const bookSections = pgTable("book_sections", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookId: uuid("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
  sectionIndex: integer("section_index").notNull(),
  href: text("href").notNull(),
  title: text("title"),
  html: text("html"),
  htmlGzip: text("html_gzip"), // Stored as text (base64 encoded if needed) since bytea is not available in this Drizzle version
  plainText: text("plain_text"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  bookSectionUnique: uniqueIndex("book_sections_book_id_section_index_idx").on(table.bookId, table.sectionIndex),
}));

export const chunks = pgTable("chunks", {
  id: bigint("id", { mode: "number" }).primaryKey().notNull(),
  bookId: uuid("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  sectionId: uuid("section_id").notNull().references(() => bookSections.id, { onDelete: "cascade" }),
  sectionIndex: integer("section_index").notNull(),
  text: text("text").notNull(),
  wordCount: integer("word_count").notNull(),
  sourceHint: jsonb("source_hint"),
}, (table) => ({
  bookChunkUnique: uniqueIndex("chunks_book_id_chunk_index_idx").on(table.bookId, table.chunkIndex),
  bookChunkIndex: index("chunks_book_id_chunk_index_idx").on(table.bookId, table.chunkIndex),
}));

export const sessionBooks = pgTable("session_books", {
  sessionId: uuid("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  bookId: uuid("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
  addedAt: timestamp("added_at").notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.sessionId, table.bookId] }),
}));

export const readingProgress = pgTable("reading_progress", {
  sessionId: uuid("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  bookId: uuid("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
  currentChunkIndex: integer("current_chunk_index").notNull().default(0),
  unlockedUntilChunkIndex: integer("unlocked_until_chunk_index").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.sessionId, table.bookId] }),
}));

export const quizzes = pgTable("quizzes", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id").notNull().references(() => sessions.id, { onDelete: "cascade" }),
  bookId: uuid("book_id").notNull().references(() => books.id, { onDelete: "cascade" }),
  gateStartChunkIndex: integer("gate_start_chunk_index").notNull(),
  gateEndChunkIndex: integer("gate_end_chunk_index").notNull(),
  facts: jsonb("facts").notNull(),
  questions: jsonb("questions").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  uniqueQuiz: uniqueIndex("quizzes_session_id_book_id_gate_start_chunk_index_gate_end_chunk_index_idx").on(
    table.sessionId,
    table.bookId,
    table.gateStartChunkIndex,
    table.gateEndChunkIndex
  ),
}));

export const quizAttempts = pgTable("quiz_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  quizId: uuid("quiz_id").notNull().references(() => quizzes.id, { onDelete: "cascade" }),
  answers: jsonb("answers").notNull(),
  correctCount: integer("correct_count").notNull(),
  passed: boolean("passed").notNull(),
  answeredAt: timestamp("answered_at").notNull().defaultNow(),
});

// Relations
export const sessionsRelations = relations(sessions, ({ many }) => ({
  sessionBooks: many(sessionBooks),
  readingProgress: many(readingProgress),
  quizzes: many(quizzes),
}));

export const booksRelations = relations(books, ({ many }) => ({
  sections: many(bookSections),
  chunks: many(chunks),
  sessionBooks: many(sessionBooks),
  readingProgress: many(readingProgress),
  quizzes: many(quizzes),
}));

export const bookSectionsRelations = relations(bookSections, ({ one, many }) => ({
  book: one(books, {
    fields: [bookSections.bookId],
    references: [books.id],
  }),
  chunks: many(chunks),
}));

export const chunksRelations = relations(chunks, ({ one }) => ({
  book: one(books, {
    fields: [chunks.bookId],
    references: [books.id],
  }),
  section: one(bookSections, {
    fields: [chunks.sectionId],
    references: [bookSections.id],
  }),
}));

export const sessionBooksRelations = relations(sessionBooks, ({ one }) => ({
  session: one(sessions, {
    fields: [sessionBooks.sessionId],
    references: [sessions.id],
  }),
  book: one(books, {
    fields: [sessionBooks.bookId],
    references: [books.id],
  }),
}));

export const readingProgressRelations = relations(readingProgress, ({ one }) => ({
  session: one(sessions, {
    fields: [readingProgress.sessionId],
    references: [sessions.id],
  }),
  book: one(books, {
    fields: [readingProgress.bookId],
    references: [books.id],
  }),
}));

export const quizzesRelations = relations(quizzes, ({ one, many }) => ({
  session: one(sessions, {
    fields: [quizzes.sessionId],
    references: [sessions.id],
  }),
  book: one(books, {
    fields: [quizzes.bookId],
    references: [books.id],
  }),
  attempts: many(quizAttempts),
}));

export const quizAttemptsRelations = relations(quizAttempts, ({ one }) => ({
  quiz: one(quizzes, {
    fields: [quizAttempts.quizId],
    references: [quizzes.id],
  }),
}));
