import { ref, readonly } from "vue";
import type { Book, TocItem } from "epubjs";

export interface BookMetadata {
  title: string;
  author: string;
}

// Shared state - singleton pattern
const currentBook = ref<Book | null>(null);
const metadata = ref<BookMetadata | null>(null);
const toc = ref<TocItem[] | null>(null);

export const useEpubState = () => {
  const loadEpub = async (file: File) => {
    const { parseEpub, extractMetadata, extractToc } = useEpubParser();
    const book = await parseEpub(file);
    const bookMetadata = await extractMetadata(book);
    const bookToc = await extractToc(book);

    currentBook.value = book;
    metadata.value = bookMetadata;
    toc.value = bookToc;
  };

  const clearBook = () => {
    currentBook.value = null;
    metadata.value = null;
    toc.value = null;
  };

  return {
    currentBook: readonly(currentBook),
    metadata: readonly(metadata),
    toc: readonly(toc),
    loadEpub,
    clearBook,
  };
};
