import { ref, readonly } from "vue";
import type { Book } from "epubjs";

export interface BookMetadata {
  title: string;
  author: string;
}

// Shared state - singleton pattern
const currentBook = ref<Book | null>(null);
const metadata = ref<BookMetadata | null>(null);

export const useEpubState = () => {
  const loadEpub = async (file: File) => {
    const { parseEpub, extractMetadata } = useEpubParser();
    const book = await parseEpub(file);
    const bookMetadata = await extractMetadata(book);

    currentBook.value = book;
    metadata.value = bookMetadata;
  };

  const clearBook = () => {
    currentBook.value = null;
    metadata.value = null;
  };

  return {
    currentBook: readonly(currentBook),
    metadata: readonly(metadata),
    loadEpub,
    clearBook,
  };
};
