import { ref, computed, readonly } from "vue";
import { useLocalStorage } from "./useLocalStorage";
import type { ReadingState } from "~/utils/types";

const DEFAULT_STATE: ReadingState = {
  current_paragraph_index: 0,
  unlocked_until_index: 0,
  last_quiz_gate_index: -1,
  n_used: 5,
};

export function useReadingState() {
  const { saveReadingState, loadReadingState } = useLocalStorage();

  const state = ref<ReadingState>(loadReadingState() || { ...DEFAULT_STATE });

  const currentParagraphIndex = computed(
    () => state.value.current_paragraph_index
  );
  const unlockedUntilIndex = computed(() => state.value.unlocked_until_index);
  const lastQuizGateIndex = computed(() => state.value.last_quiz_gate_index);
  const nUsed = computed(() => state.value.n_used);

  const canGoNext = computed(() => {
    return (
      state.value.current_paragraph_index < state.value.unlocked_until_index
    );
  });

  const canGoPrevious = computed(() => {
    return state.value.current_paragraph_index > 0;
  });

  const goToParagraph = (index: number) => {
    if (index >= 0 && index <= state.value.unlocked_until_index) {
      state.value.current_paragraph_index = index;
      saveReadingState(state.value);
    }
  };

  const goNext = () => {
    if (canGoNext.value) {
      state.value.current_paragraph_index++;
      saveReadingState(state.value);
    }
  };

  const goPrevious = () => {
    if (canGoPrevious.value) {
      state.value.current_paragraph_index--;
      saveReadingState(state.value);
    }
  };

  const unlockUntil = (index: number) => {
    state.value.unlocked_until_index = Math.max(
      state.value.unlocked_until_index,
      index
    );
    saveReadingState(state.value);
  };

  const setLastQuizGateIndex = (index: number) => {
    state.value.last_quiz_gate_index = index;
    saveReadingState(state.value);
  };

  const setNUsed = (n: number) => {
    state.value.n_used = n;
    saveReadingState(state.value);
  };

  const reset = () => {
    state.value = { ...DEFAULT_STATE };
    saveReadingState(state.value);
  };

  return {
    state: readonly(state),
    currentParagraphIndex,
    unlockedUntilIndex,
    lastQuizGateIndex,
    nUsed,
    canGoNext,
    canGoPrevious,
    goToParagraph,
    goNext,
    goPrevious,
    unlockUntil,
    setLastQuizGateIndex,
    setNUsed,
    reset,
  };
}
