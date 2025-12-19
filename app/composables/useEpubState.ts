import { ref, readonly, computed } from "vue";
import type { Book, NavItem } from "epubjs";

export interface BookMetadata {
  title: string;
  author: string;
}

// Shared state - singleton pattern
const currentBook = ref<Book | null>(null);
const metadata = ref<BookMetadata | null>(null);
const toc = ref<NavItem[] | null>(null);
const chapterContent = ref<Record<string, string>>({});
const tocToSpineMap = ref<Record<string, string>>({});

export const useEpubState = () => {
  const loadEpub = async (file: File) => {
    const { parseEpub, extractMetadata, extractToc, renderAllChapters, createTocToSpineMap } =
      useEpubParser();
    const book = await parseEpub(file);
    const bookMetadata = await extractMetadata(book);
    const bookToc = await extractToc(book);
    const chapters = await renderAllChapters(book);
    const tocMap = await createTocToSpineMap(book, bookToc);

    currentBook.value = book;
    metadata.value = bookMetadata;
    toc.value = bookToc;
    chapterContent.value = chapters;
    tocToSpineMap.value = tocMap;
  };

  const clearBook = () => {
    currentBook.value = null;
    metadata.value = null;
    toc.value = null;
    chapterContent.value = {};
    tocToSpineMap.value = {};
  };

  return {
    currentBook: readonly(currentBook),
    metadata: readonly(metadata),
    toc: computed(() => toc.value),
    chapterContent: computed(() => chapterContent.value),
    tocToSpineMap: computed(() => tocToSpineMap.value),
    loadEpub,
    clearBook,
  };
};
