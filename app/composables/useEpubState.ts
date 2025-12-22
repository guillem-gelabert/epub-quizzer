import { ref, readonly, computed } from "vue";
import type { NavItem, BookMetadata } from "~/types/epub";
import {
  graphqlQuery,
  GET_BOOKS,
  GET_BOOK,
  GET_BOOK_TOC,
  ADD_BOOK_TO_SESSION,
} from "./useGraphQL";

// Shared state - singleton pattern
const currentBookId = ref<string | null>(null);
const metadata = ref<BookMetadata | null>(null);
const toc = ref<NavItem[] | null>(null);
const chapterContent = ref<Record<string, string>>({});
const tocToSpineMap = ref<Record<string, string>>({});

export const useEpubState = () => {
  const loadEpub = async (file: File) => {
    // Upload file to server (handles parsing and DB storage)
    const formData = new FormData();
    formData.append("file", file);

    const uploadResponse = await $fetch<{ bookId: string; filename: string }>(
      "/api/books/upload",
      {
        method: "POST",
        body: formData,
      }
    );

    const bookId = uploadResponse.bookId;

    // Add book to session via GraphQL
    await graphqlQuery(ADD_BOOK_TO_SESSION, { bookId });

    // Load book data from GraphQL
    await loadBookFromServer(bookId);
  };

  const loadBookFromServer = async (bookId: string) => {
    try {
      // Load book data from GraphQL
      const bookData = await graphqlQuery<{ book: any }>(GET_BOOK, { id: bookId });
      const book = bookData.book;

      if (!book) {
        throw new Error("Book not found");
      }

      // Load TOC
      const tocData = await graphqlQuery<{ bookToc: NavItem[] }>(GET_BOOK_TOC, {
        bookId,
      });

      // Build chapter content from sections
      const chapters: Record<string, string> = {};
      const tocMap: Record<string, string> = {};

      for (const section of book.sections || []) {
        chapters[section.href] = section.html || "";
      }

      // Build TOC to spine map (simplified - could be enhanced)
      if (tocData.bookToc && Array.isArray(tocData.bookToc)) {
        for (const tocItem of tocData.bookToc) {
          if (tocItem.href) {
            const normalizedHref = tocItem.href.split("#")[0];
            tocMap[normalizedHref] = normalizedHref;
          }
        }
      }

      // Update local state
      currentBookId.value = bookId;
      metadata.value = {
        title: book.title,
        author: book.author,
      };
      toc.value = (tocData.bookToc as NavItem[]) || [];
      chapterContent.value = chapters;
      tocToSpineMap.value = tocMap;

      // Store bookId in localStorage
      if (import.meta.client) {
        localStorage.setItem("currentBookId", bookId);
      }
    } catch (error) {
      console.error("Failed to load book from server:", error);
      throw error;
    }
  };

  const clearBook = () => {
    currentBookId.value = null;
    metadata.value = null;
    toc.value = null;
    chapterContent.value = {};
    tocToSpineMap.value = {};

    if (import.meta.client) {
      localStorage.removeItem("currentBookId");
    }
  };

  // Initialize function to load book from GraphQL
  const initializeBook = async () => {
    if (import.meta.client && !currentBookId.value) {
      // First try to load from localStorage
      const storedBookId = localStorage.getItem("currentBookId");
      if (storedBookId) {
        try {
          await loadBookFromServer(storedBookId);
          return;
        } catch (err) {
          console.error("Failed to load stored book:", err);
          localStorage.removeItem("currentBookId");
        }
      }

      // If no stored book, load the first available book from GraphQL
      try {
        const booksData = await graphqlQuery<{ books: any[] }>(GET_BOOKS);
        if (booksData.books && booksData.books.length > 0) {
          // Load the first book
          await loadBookFromServer(booksData.books[0].id);
        }
      } catch (err) {
        console.error("Failed to load books from GraphQL:", err);
      }
    }
  };

  return {
    currentBookId: readonly(currentBookId),
    metadata: readonly(metadata),
    toc: computed(() => toc.value),
    chapterContent: computed(() => chapterContent.value),
    tocToSpineMap: computed(() => tocToSpineMap.value),
    loadEpub,
    loadBookFromServer,
    initializeBook,
    clearBook,
  };
};
