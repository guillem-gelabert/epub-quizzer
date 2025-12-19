import { ref, readonly, computed } from "vue";
import type { Book, NavItem } from "epubjs";

export interface BookMetadata {
  title: string;
  author: string;
}

// Shared state - singleton pattern
const currentBookId = ref<string | null>(null);
const currentBook = ref<Book | null>(null);
const metadata = ref<BookMetadata | null>(null);
const toc = ref<NavItem[] | null>(null);
const chapterContent = ref<Record<string, string>>({});
const tocToSpineMap = ref<Record<string, string>>({});

export const useEpubState = () => {
  const loadEpub = async (file: File) => {
    // Upload file to server first
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

    // Parse the book
    const { parseEpub, extractMetadata, extractToc, renderAllChapters, createTocToSpineMap } =
      useEpubParser();
    const book = await parseEpub(file);
    const bookMetadata = await extractMetadata(book);
    const bookToc = await extractToc(book);
    const chapters = await renderAllChapters(book);
    const tocMap = await createTocToSpineMap(book, bookToc);

    // Store parsed data on server
    await $fetch(`/api/books/${bookId}/data`, {
      method: "POST",
      body: {
        metadata: bookMetadata,
        toc: bookToc,
        chapterContent: chapters,
        tocToSpineMap: tocMap,
      },
    });

    // Update local state
    currentBookId.value = bookId;
    currentBook.value = book;
    metadata.value = bookMetadata;
    toc.value = bookToc;
    chapterContent.value = chapters;
    tocToSpineMap.value = tocMap;

    // Store bookId in localStorage for persistence
    if (import.meta.client) {
      localStorage.setItem("currentBookId", bookId);
    }
  };

  const loadBookFromServer = async (bookId: string) => {
    try {
      // Load parsed data from server
      const data = await $fetch<{
        metadata: BookMetadata;
        toc: NavItem[];
        chapterContent: Record<string, string>;
        tocToSpineMap: Record<string, string>;
      }>(`/api/books/${bookId}/data`);

      // Load EPUB file to create Book object
      const fileResponse = await fetch(`/api/books/${bookId}/file`);
      const fileBlob = await fileResponse.blob();
      const file = new File([fileBlob], "book.epub", { type: "application/epub+zip" });

      const { parseEpub } = useEpubParser();
      const book = await parseEpub(file);

      // Update local state
      currentBookId.value = bookId;
      currentBook.value = book;
      metadata.value = data.metadata;
      toc.value = data.toc;
      chapterContent.value = data.chapterContent;
      tocToSpineMap.value = data.tocToSpineMap;

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
    currentBook.value = null;
    metadata.value = null;
    toc.value = null;
    chapterContent.value = {};
    tocToSpineMap.value = {};

    if (import.meta.client) {
      localStorage.removeItem("currentBookId");
    }
  };

  // Initialize function to load book from storage
  const initializeBook = async () => {
    if (import.meta.client && !currentBookId.value) {
      const storedBookId = localStorage.getItem("currentBookId");
      if (storedBookId) {
        try {
          await loadBookFromServer(storedBookId);
        } catch (err) {
          console.error("Failed to load stored book:", err);
          localStorage.removeItem("currentBookId");
        }
      }
    }
  };

  return {
    currentBookId: readonly(currentBookId),
    currentBook: readonly(currentBook),
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
