import {
  saveToLocalStorage,
  loadFromLocalStorage,
  removeFromLocalStorage,
} from "~/utils/storage";
import type {
  BookMetadata,
  ReadingState,
  Settings,
  QuizState,
} from "~/utils/types";

const STORAGE_KEYS = {
  BOOK_METADATA: "epub-quizzer:book-metadata",
  READING_STATE: "epub-quizzer:reading-state",
  SETTINGS: "epub-quizzer:settings",
  QUIZ_STATE: (gateIndex: number) => `epub-quizzer:quiz-state:${gateIndex}`,
} as const;

export function useLocalStorage() {
  const saveBookMetadata = (metadata: BookMetadata) => {
    saveToLocalStorage(STORAGE_KEYS.BOOK_METADATA, metadata);
  };

  const loadBookMetadata = (): BookMetadata | null => {
    return loadFromLocalStorage<BookMetadata>(STORAGE_KEYS.BOOK_METADATA);
  };

  const saveReadingState = (state: ReadingState) => {
    saveToLocalStorage(STORAGE_KEYS.READING_STATE, state);
  };

  const loadReadingState = (): ReadingState | null => {
    return loadFromLocalStorage<ReadingState>(STORAGE_KEYS.READING_STATE);
  };

  const saveSettings = (settings: Settings) => {
    saveToLocalStorage(STORAGE_KEYS.SETTINGS, settings);
  };

  const loadSettings = (): Settings | null => {
    return loadFromLocalStorage<Settings>(STORAGE_KEYS.SETTINGS);
  };

  const saveQuizState = (gateIndex: number, quizState: QuizState) => {
    saveToLocalStorage(STORAGE_KEYS.QUIZ_STATE(gateIndex), quizState);
  };

  const loadQuizState = (gateIndex: number): QuizState | null => {
    return loadFromLocalStorage<QuizState>(STORAGE_KEYS.QUIZ_STATE(gateIndex));
  };

  const clearAll = () => {
    removeFromLocalStorage(STORAGE_KEYS.BOOK_METADATA);
    removeFromLocalStorage(STORAGE_KEYS.READING_STATE);
    removeFromLocalStorage(STORAGE_KEYS.SETTINGS);
    const metadata = loadBookMetadata();
    if (metadata) {
      const readingState = loadReadingState();
      if (readingState) {
        for (
          let i = 0;
          i <= readingState.last_quiz_gate_index;
          i += readingState.n_used
        ) {
          removeFromLocalStorage(STORAGE_KEYS.QUIZ_STATE(i));
        }
      }
    }
  };

  return {
    saveBookMetadata,
    loadBookMetadata,
    saveReadingState,
    loadReadingState,
    saveSettings,
    loadSettings,
    saveQuizState,
    loadQuizState,
    clearAll,
  };
}
