<template>
  <div class="question-container">
    <h2 class="question-text">{{ question }}</h2>
    <div class="radio-group">
      <label
        v-for="(answer, index) in answers"
        :key="index"
        class="radio-label"
        :class="{
          'answer-correct': index === correctIndex,
        }"
      >
        <input
          type="radio"
          :name="`question-${questionId}`"
          :value="index"
          :checked="selectedAnswer === index"
          @change="handleAnswerSelect(index)"
          class="radio-input"
          :disabled="isAnswered"
        />
        <span class="radio-text"
          >{{ getChoiceLabel(index) }}. {{ answer }}</span
        >
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
interface Props {
  question: string;
  answers: Array<string>;
  correctIndex: number;
  questionId?: string | number;
  gateIndex: number;
  questionInGateIndex: number;
  isCurrentQuestion: boolean;
  totalQuestionsInGate: number;
  existingAnswer?: string | null;
}

const props = withDefaults(defineProps<Props>(), {
  questionId: () => Math.random().toString(36).substring(7),
  existingAnswer: null,
});

const emit = defineEmits<{
  answerSubmitted: [
    {
      gateIndex: number;
      questionInGateIndex: number;
      answer: string;
      choiceIndex: number;
    }
  ];
}>();

const selectedAnswer = ref<number | null>(
  props.existingAnswer !== null && props.existingAnswer !== undefined
    ? ["A", "B", "C"].indexOf(props.existingAnswer)
    : null
);
const isAnswered = ref(props.existingAnswer !== null && props.existingAnswer !== undefined);

// Watch for changes to existingAnswer prop
watch(
  () => props.existingAnswer,
  (newAnswer) => {
    if (newAnswer !== null && newAnswer !== undefined) {
      selectedAnswer.value = ["A", "B", "C"].indexOf(newAnswer);
      isAnswered.value = true;
    } else {
      selectedAnswer.value = null;
      isAnswered.value = false;
    }
  }
);

const getChoiceLabel = (index: number): string => {
  return String.fromCharCode(65 + index); // A, B, C, D, etc.
};

const handleAnswerSelect = async (choiceIndex: number) => {
  // Only process if this is the current question and not already answered
  if (!props.isCurrentQuestion || isAnswered.value) {
    return;
  }

  selectedAnswer.value = choiceIndex;
  const answerKey = getChoiceLabel(choiceIndex);

  // Mark as answered immediately
  isAnswered.value = true;

  // Emit the answer to parent
  emit("answerSubmitted", {
    gateIndex: props.gateIndex,
    questionInGateIndex: props.questionInGateIndex,
    answer: answerKey,
    choiceIndex,
  });
};
</script>

<style scoped>
.question-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 42rem;
  gap: 2rem;
}

.question-text {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1f2937;
  text-align: center;
}

.radio-group {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  max-width: 32rem;

  &:has(.radio-input:checked) .answer-correct {
    border-color: #10b981;
    background-color: #d1fae5;
  }
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  background-color: #ffffff;
  cursor: pointer;
  transition: all 0.2s;

  &:has(.radio-input:checked) {
    border-width: 3px;

    &:not(.answer-correct) {
      border-color: #ef4444;
      background-color: #fee2e2;
    }
  }
}

.radio-label:hover {
  border-color: #d1d5db;
  background-color: #f9fafb;
}

.radio-input {
  width: 1.25rem;
  height: 1.25rem;
  cursor: pointer;
}

.radio-input:checked + .radio-text {
  font-weight: 600;
}

.radio-label.answer-correct .radio-input:checked + .radio-text {
  color: #10b981;
}

.radio-text {
  font-size: 1.125rem;
  color: #1f2937;
}
</style>
