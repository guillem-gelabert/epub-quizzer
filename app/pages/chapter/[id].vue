<template>
  <div class="chapter-container">
    <div
      v-if="!paragraphs"
      class="flex items-center justify-center min-h-screen"
    >
      <p class="text-gray-600">Loading chapter...</p>
    </div>
    <div v-else class="chapter-wrapper">
      <!-- Vertical breadcrumbs -->
      <div class="breadcrumbs-container">
        <div class="breadcrumbs-track">
          <div
            v-for="(item, index) in displayItems"
            :key="index"
            class="breadcrumb-dot"
            :class="{
              'breadcrumb-read': readItems.has(index),
              'breadcrumb-current': index === currentItemIndex,
            }"
            :style="{
              top: `${(index / Math.max(displayItems.length - 1, 1)) * 100}%`,
            }"
          ></div>
        </div>
      </div>
      <div
        ref="scrollContainer"
        class="scroll-container"
        @scroll="handleScrollIndicator"
      >
        <div
          class="scroll-content"
          :style="{ height: `${totalContentHeight}vh` }"
        >
          <div
            v-for="(item, index) in displayItems"
            :key="index"
            class="paragraph-snap"
            :data-index="index"
          >
            <div v-if="item.type === 'paragraph'" class="paragraph-content">
              <p v-html="item.content"></p>
            </div>
            <div
              v-else-if="item.type === 'question'"
              class="question-container"
            >
              <div v-if="item.isLoading" class="loading-state">
                <p class="loading-text">Generating questions...</p>
                <p class="loading-hint">This may take up to a minute</p>
              </div>
              <template
                v-else-if="
                  item.questionData &&
                  item.questionGateIndex !== undefined &&
                  item.questionInGateIndex !== undefined
                "
              >
                <QuizQuestion
                  :question="item.questionData.question"
                  :answers="
                    Object.values(item.questionData.choices) as Array<string>
                  "
                  :correct-index="
                    ['A', 'B', 'C'].indexOf(item.questionData.correct_choice)
                  "
                  :question-id="`${item.questionGateIndex}-${item.questionInGateIndex}`"
                  :gate-index="item.questionGateIndex!"
                  :question-in-gate-index="item.questionInGateIndex!"
                  :is-current-question="
                    (currentQuestionIndex.get(item.questionGateIndex!) ?? 0) ===
                    item.questionInGateIndex
                  "
                  :total-questions-in-gate="
                    generatedQuestions.get(item.questionGateIndex!)?.length ?? 0
                  "
                  :existing-answer="
                    questionAnswers.get(
                      `${item.questionGateIndex}-${item.questionInGateIndex}`
                    )
                  "
                  @answer-submitted="handleQuestionAnswerSubmitted"
                />
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import type { ReaderState, Chunk } from "~/composables/useOpenAi";
import type { McqQuestion } from "~/composables/useQuizGenerator";
import {
  graphqlQuery,
  graphqlMutation,
  GET_CHUNKS,
  GET_PROGRESS,
  UPDATE_PROGRESS,
  GET_BOOK,
} from "~/composables/useGraphQL";

const route = useRoute();
const { toc, chapterContent, tocToSpineMap, currentBookId } = useEpubState();
const { generateQuiz } = useQuizGenerator();

const paragraphs = ref<string[]>([]);
const scrollContainer = ref<HTMLElement | null>(null);
const answeredQuestions = ref<Set<number>>(new Set());
const selectedAnswers = ref<Map<number, string>>(new Map()); // Changed to string for "A" | "B" | "C"
// Track answers per question (gateIndex-questionIndex -> answer)
const questionAnswers = ref<Map<string, string>>(new Map());
const currentItemIndex = ref<number>(0);
const readItems = ref<Set<number>>(new Set());
// Track paragraph indices that have been read (for mapping to chunks)
const readParagraphIndices = ref<Set<number>>(new Set());
// Store chunks from server for mapping
const serverChunks = ref<
  Array<{
    id: string;
    chunkIndex: number;
    text: string;
    wordCount: number;
    sectionIndex: number;
  }>
>([]);
// Store current section index for the chapter
const currentSectionIndex = ref<number | null>(null);

// Gate positions pre-calculated when chapter loads
const gatePositions = ref<
  Array<{
    gateIndex: number;
    startParagraphIndex: number;
    endParagraphIndex: number;
    chunks: Chunk[];
    wordCount: number;
  }>
>([]);

// Reader state management
const readerState = ref<ReaderState>({
  section_title: undefined,
  entities: [],
  prior_summary: undefined,
});

// Generated questions per gate
const generatedQuestions = ref<Map<number, McqQuestion[]>>(new Map());
const currentQuestionIndex = ref<Map<number, number>>(new Map());
const loadingQuestions = ref<Set<number>>(new Set());
const questionStates = ref<Map<number, ReaderState>>(new Map()); // Store nextState per gate

interface DisplayItem {
  type: "paragraph" | "question";
  content?: string;
  questionIndex?: number;
  questionGateIndex?: number; // Which gate this question belongs to
  questionInGateIndex?: number; // Which question within the gate (0, 1, 2, etc.)
  selectedAnswer?: string;
  isCorrect?: boolean;
  questionData?: McqQuestion; // The actual question data
  isLoading?: boolean;
}

// Helper function to count words in HTML content
const countWords = (html: string): number => {
  // Strip HTML tags using regex
  const text = html.replace(/<[^>]*>/g, " ");
  // Decode HTML entities (basic ones)
  const decoded = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  // Split by whitespace and filter out empty strings
  const words = decoded
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  return words.length;
};

// Helper function to check if a paragraph is a heading (h1-h5)
const isHeading = (html: string): boolean => {
  // Check if the HTML starts with a heading tag (h1-h5)
  const headingRegex = /^<h[1-5][^>]*>/i;
  return headingRegex.test(html.trim());
};

// Helper function to strip HTML and get plain text
const stripHtml = (html: string): string => {
  const text = html.replace(/<[^>]*>/g, " ");
  const decoded = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return decoded.trim().replace(/\s+/g, " ");
};

// Helper function to convert paragraphs to chunks
const paragraphsToChunks = (
  paragraphs: string[],
  startIndex: number,
  endIndex: number
): Chunk[] => {
  return paragraphs.slice(startIndex, endIndex).map((para, idx) => ({
    id: `chunk-${startIndex + idx}`,
    text: stripHtml(para),
  }));
};

// Pre-calculate all gate positions when chapter loads
const precalculateGates = () => {
  const gates: Array<{
    gateIndex: number;
    startParagraphIndex: number;
    endParagraphIndex: number;
    chunks: Chunk[];
    wordCount: number;
  }> = [];

  let gateIndex = 0;
  let wordsSinceLastQuestion = 0;
  let lastQuestionParagraphIndex = 0;
  const WORD_THRESHOLD_1 = 300;
  const WORD_THRESHOLD_2 = 450;

  paragraphs.value.forEach((paragraph, index) => {
    const paragraphWords = countWords(paragraph);
    const isLastParagraph = index === paragraphs.value.length - 1;
    const isCurrentHeading = isHeading(paragraph);
    const MIN_WORDS_BEFORE_HEADING = 60;

    // Check if we should insert a question before this paragraph
    const shouldInsertQuestion =
      !isLastParagraph &&
      (wordsSinceLastQuestion > WORD_THRESHOLD_1 ||
        wordsSinceLastQuestion + paragraphWords > WORD_THRESHOLD_2 ||
        (isCurrentHeading &&
          wordsSinceLastQuestion >= MIN_WORDS_BEFORE_HEADING));

    if (shouldInsertQuestion) {
      // Collect chunks since last question
      const chunks = paragraphsToChunks(
        paragraphs.value,
        lastQuestionParagraphIndex,
        index
      );

      // Calculate total word count for these chunks
      const totalWordCount = chunks.reduce((sum, chunk) => {
        return sum + countWords(chunk.text);
      }, 0);

      // Store gate information
      gates.push({
        gateIndex,
        startParagraphIndex: lastQuestionParagraphIndex,
        endParagraphIndex: index,
        chunks,
        wordCount: totalWordCount,
      });

      // Reset word count after inserting question
      wordsSinceLastQuestion = 0;
      lastQuestionParagraphIndex = index;
      gateIndex++;
    }

    // Update word count
    wordsSinceLastQuestion += paragraphWords;
  });

  gatePositions.value = gates;
  console.log(`Pre-calculated ${gates.length} gates`);
};

// Function to calculate number of questions based on word count
const calculateQuestionCount = (wordCount: number): 1 | 2 | 3 | 4 => {
  if (wordCount < 200) {
    return 1;
  } else if (wordCount < 300) {
    return 2;
  } else if (wordCount < 400) {
    return 3;
  } else {
    return 4;
  }
};

// Function to generate questions for a gate
const generateQuestionsForGate = async (
  gateIndex: number,
  chunks: Chunk[],
  wordCount: number,
  paragraphIndex: number
) => {
  if (
    loadingQuestions.value.has(gateIndex) ||
    generatedQuestions.value.has(gateIndex)
  ) {
    return;
  }

  if (chunks.length === 0) {
    console.warn("No chunks provided for question generation");
    return;
  }

  loadingQuestions.value.add(gateIndex);

  try {
    const questionCount = calculateQuestionCount(wordCount);
    console.log(
      `Generating ${questionCount} questions for gate ${gateIndex} with ${chunks.length} chunks (${wordCount} words)`
    );

    // Get chapter number from route
    const chapterNumber = route.params.id as string;

    // Add timeout to prevent hanging forever
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Question generation timeout")), 60000); // 60 second timeout
    });

    // Get current book ID
    if (!currentBookId.value) {
      throw new Error("No book selected");
    }

    // Find the gate from gatePositions
    const gate = gatePositions.value.find((g) => g.gateIndex === gateIndex);
    if (!gate) {
      throw new Error(`Gate ${gateIndex} not found`);
    }

    // Calculate chunk indices for the gate
    // Map paragraph indices to global chunk indices
    const gateStartChunkIndex = paragraphIndexToGlobalChunkIndex(
      gate.startParagraphIndex
    );
    const gateEndChunkIndex = paragraphIndexToGlobalChunkIndex(
      gate.endParagraphIndex
    );

    const quizPromise = generateQuiz({
      bookId: currentBookId.value,
      gateStartChunkIndex,
      gateEndChunkIndex,
    });

    const result = (await Promise.race([
      quizPromise,
      timeoutPromise,
    ])) as Awaited<ReturnType<typeof generateQuiz>>;

    console.log(
      `Questions generated for gate ${gateIndex}:`,
      result.mcq.questions.length
    );
    generatedQuestions.value.set(gateIndex, result.mcq.questions);
    currentQuestionIndex.value.set(gateIndex, 0);
    questionStates.value.set(gateIndex, result.nextState);
  } catch (error) {
    console.error("Failed to generate questions:", error);
    // Create a fallback question so the user can continue
    generatedQuestions.value.set(gateIndex, [
      {
        id: "Q1",
        question: "What number is bigger?",
        choices: {
          A: "1",
          B: "36",
          C: "1987",
        },
        correct_choice: "C",
        fact_ids: [],
        evidence: [],
      },
    ]);
    currentQuestionIndex.value.set(gateIndex, 0);
    questionStates.value.set(gateIndex, readerState.value);
  } finally {
    loadingQuestions.value.delete(gateIndex);
  }
};

const displayItems = computed<DisplayItem[]>(() => {
  const items: DisplayItem[] = [];
  let currentGateIndex = 0;

  paragraphs.value.forEach((paragraph, index) => {
    // Check if we should insert a question before this paragraph
    // (based on pre-calculated gate positions)
    const gate = gatePositions.value[currentGateIndex];
    if (gate && gate.endParagraphIndex === index) {
      // Insert question at this position
      const questions = generatedQuestions.value.get(gate.gateIndex) || [];
      const currentQIndex = currentQuestionIndex.value.get(gate.gateIndex) ?? 0;
      const isLoading = loadingQuestions.value.has(gate.gateIndex);
      const currentQuestion = questions[currentQIndex];

      const allQuestionsAnswered = answeredQuestions.value.has(gate.gateIndex);

      // Show loading state
      if (isLoading || questions.length === 0) {
        items.push({
          type: "question",
          questionIndex: gate.gateIndex,
          questionGateIndex: gate.gateIndex,
          questionInGateIndex: currentQIndex,
          isLoading: true,
        });
      } else {
        // Show all questions sequentially
        questions.forEach((question, qIdx) => {
          const answerKey = `${gate.gateIndex}-${qIdx}`;
          const answer = questionAnswers.value.get(answerKey);
          const isAnswered = answer !== undefined;
          const isCurrent = qIdx === currentQIndex;

          // Show question
          items.push({
            type: "question",
            questionIndex: gate.gateIndex,
            questionGateIndex: gate.gateIndex,
            questionInGateIndex: qIdx,
            questionData: question,
            selectedAnswer: answer,
            isCorrect: answer ? answer === question.correct_choice : undefined,
          });
        });
      }

      currentGateIndex++;
    }

    // Add the paragraph
    items.push({
      type: "paragraph",
      content: paragraph,
    });
  });

  return items;
});

const maxScrollHeight = ref<number | null>(null);
const totalContentHeight = computed(() => {
  // Total height is number of display items * 100vh (each item takes full viewport height)
  return displayItems.value.length * 100;
});

// Computed: Get highest read paragraph index
const highestReadParagraphIndex = computed(() => {
  if (readParagraphIndices.value.size === 0) {
    return -1;
  }
  return Math.max(...Array.from(readParagraphIndices.value));
});

// Map paragraph index to global chunk index
const paragraphIndexToGlobalChunkIndex = (paragraphIndex: number): number => {
  // If we have chunks loaded and know the current section
  if (serverChunks.value.length > 0 && currentSectionIndex.value !== null) {
    // Find chunks for the current section
    const sectionChunks = serverChunks.value.filter(
      (c) => c.sectionIndex === currentSectionIndex.value
    );

    if (sectionChunks.length > 0) {
      // Sort by chunkIndex to ensure order
      sectionChunks.sort((a, b) => a.chunkIndex - b.chunkIndex);

      // Map paragraph index to chunk index within the section
      // Since paragraphs may not map 1:1 to chunks, use a simple approximation:
      // paragraph index maps to chunk index within section, then add the starting global chunk index
      const chunkIndexInSection = Math.min(
        paragraphIndex,
        sectionChunks.length - 1
      );
      const matchingChunk = sectionChunks[chunkIndexInSection];
      return matchingChunk?.chunkIndex ?? sectionChunks[0]?.chunkIndex ?? 0;
    }
  }

  // Fallback: if no chunks loaded, return paragraph index (will be wrong but won't crash)
  return paragraphIndex;
};

// Map paragraph index to chunk index using gate positions and server chunks (legacy, kept for compatibility)
const paragraphIndexToChunkIndex = (paragraphIndex: number): number => {
  return paragraphIndexToGlobalChunkIndex(paragraphIndex);
};

// Watch for changes and update maxScrollHeight
watch(
  [displayItems, currentQuestionIndex, questionAnswers, answeredQuestions],
  () => {
    nextTick(() => {
      if (!scrollContainer.value || displayItems.value.length === 0) {
        maxScrollHeight.value = null;
        return;
      }

      // Find the current unanswered question
      for (const gate of gatePositions.value) {
        const allQuestionsAnswered = answeredQuestions.value.has(
          gate.gateIndex
        );
        if (allQuestionsAnswered) {
          continue; // Skip gates that are fully answered
        }

        const currentQIndex =
          currentQuestionIndex.value.get(gate.gateIndex) ?? 0;

        // Find the current unanswered question in displayItems
        const questionItemIndex = displayItems.value.findIndex(
          (item) =>
            item.type === "question" &&
            item.questionGateIndex === gate.gateIndex &&
            item.questionInGateIndex === currentQIndex
        );

        if (questionItemIndex >= 0) {
          // Calculate height based on item index: each item is 100vh
          // Get viewport height in pixels
          const vh = window.innerHeight;
          maxScrollHeight.value = (questionItemIndex + 1) * vh;
          return;
        }
      }

      // If no unanswered question found, allow full scrolling
      maxScrollHeight.value = null;
    });
  },
  { deep: true, immediate: true }
);

// Normalize href: remove fragment and ensure leading slash
const normalizeHref = (href: string): string => {
  const withoutFragment = href.split("#")[0] || href;
  return withoutFragment.startsWith("/")
    ? withoutFragment
    : `/${withoutFragment}`;
};

const extractParagraphs = (html: string): string[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // Get all first level children of the body
  const elements = Array.from(doc.body.children.item(0)?.children || []);

  const extracted: string[] = [];

  elements.forEach((el) => {
    const text = el.textContent?.trim();

    // TODO: Handle images

    if (text && text.length > 0) {
      // Preserve the HTML structure for the paragraph
      extracted.push(el.outerHTML);
    }
  });

  // If no block elements found, split by line breaks
  if (extracted.length === 0) {
    const bodyText = doc.body.textContent || "";
    const lines = bodyText
      .split(/\n+/)
      .filter((line) => line.trim().length > 0);
    extracted.push(...lines.map((line) => `<p>${line.trim()}</p>`));
  }

  return extracted;
};

// Scroll indicator handler
const handleScrollIndicator = () => {
  if (!scrollContainer.value) {
    return;
  }

  const container = scrollContainer.value;
  const scrollTop = container.scrollTop;
  const containerHeight = container.clientHeight;
  const viewportCenter = scrollTop + containerHeight / 2;

  // Find which item is currently centered in view
  const items = container.querySelectorAll(".paragraph-snap");
  let closestIndex = 0;
  let minDistance = Infinity;

  items.forEach((item, index) => {
    const element = item as HTMLElement;
    const itemTop = element.offsetTop;
    const itemHeight = element.offsetHeight;
    const itemCenter = itemTop + itemHeight / 2;
    const distance = Math.abs(viewportCenter - itemCenter);

    if (distance < minDistance) {
      minDistance = distance;
      closestIndex = index;
    }
  });

  // Update current item
  currentItemIndex.value = closestIndex;

  // Mark all items before current as read
  let paragraphCount = 0;
  for (let i = 0; i < closestIndex; i++) {
    readItems.value.add(i);

    // Also track paragraph indices (not questions)
    const item = displayItems.value[i];
    if (item && item.type === "paragraph") {
      readParagraphIndices.value.add(paragraphCount);
      paragraphCount++;
    }
  }
};

const handleQuestionAnswerSubmitted = async (event: {
  gateIndex: number;
  questionInGateIndex: number;
  answer: string;
  choiceIndex: number;
}) => {
  const { gateIndex, questionInGateIndex, answer } = event;

  const questions = generatedQuestions.value.get(gateIndex) || [];
  const currentQuestion = questions[questionInGateIndex];

  if (!currentQuestion) {
    return;
  }

  // Store the answer for this specific question
  const answerKey = `${gateIndex}-${questionInGateIndex}`;
  questionAnswers.value.set(answerKey, answer);

  // Check if there are more questions in this gate
  const hasMoreQuestions = questionInGateIndex < questions.length - 1;

  if (hasMoreQuestions) {
    // Move to next question in the gate
    currentQuestionIndex.value.set(gateIndex, questionInGateIndex + 1);

    // Auto-scroll to next question in sequence
    setTimeout(() => {
      if (scrollContainer.value) {
        const items = scrollContainer.value.querySelectorAll(".paragraph-snap");
        const nextQuestionIndex = displayItems.value.findIndex(
          (item) =>
            item.type === "question" &&
            item.questionGateIndex === gateIndex &&
            item.questionInGateIndex === questionInGateIndex + 1
        );

        if (nextQuestionIndex >= 0) {
          const nextQuestionElement = items[nextQuestionIndex] as HTMLElement;
          if (nextQuestionElement) {
            const containerHeight = scrollContainer.value.clientHeight;
            const questionTop =
              nextQuestionElement.offsetTop -
              containerHeight / 2 +
              nextQuestionElement.offsetHeight / 2;
            scrollContainer.value.scrollTo({
              top: questionTop,
              behavior: "smooth",
            });
          }
        }
      }
    }, 100);
    return;
  }

  // All questions in gate are answered, update reader state and show score
  const nextState = questionStates.value.get(gateIndex);
  if (nextState) {
    readerState.value = nextState;
  }

  answeredQuestions.value.add(gateIndex);

  // Mark all paragraphs up to the end of this gate as read (if not already read)
  const gate = gatePositions.value.find((g) => g.gateIndex === gateIndex);
  if (gate) {
    // Mark paragraphs up to gate end as read
    for (
      let i = 0;
      i <= gate.endParagraphIndex && i < paragraphs.value.length;
      i++
    ) {
      readParagraphIndices.value.add(i);
    }

    // Also mark corresponding display items as read
    let paragraphCount = 0;
    for (
      let displayItemIndex = 0;
      displayItemIndex < displayItems.value.length;
      displayItemIndex++
    ) {
      const item = displayItems.value[displayItemIndex];
      if (item && item.type === "paragraph") {
        if (paragraphCount <= gate.endParagraphIndex) {
          readItems.value.add(displayItemIndex);
        }
        paragraphCount++;
      }
    }
  }

  // Sync read progress to server after gate completion
  await syncProgressToServer();

  // Generate questions for next gate if available
  const nextGateIndex = gateIndex + 1;
  if (nextGateIndex < gatePositions.value.length) {
    const nextGate = gatePositions.value[nextGateIndex];
    if (
      nextGate &&
      !generatedQuestions.value.has(nextGateIndex) &&
      !loadingQuestions.value.has(nextGateIndex)
    ) {
      generateQuestionsForGate(
        nextGateIndex,
        nextGate.chunks,
        nextGate.wordCount,
        nextGate.endParagraphIndex
      );
    }
  }
};

// Sync progress to server
const syncProgressToServer = async () => {
  if (!currentBookId.value) {
    console.warn("Cannot sync progress: no book ID");
    return;
  }

  try {
    // Get highest read paragraph index
    const highestParagraphIndex = highestReadParagraphIndex.value;

    // If no paragraphs read yet, use 0 as minimum
    const paragraphIndexToSync = Math.max(0, highestParagraphIndex);

    // Map to chunk index using the mapping function
    const chunkIndex = paragraphIndexToChunkIndex(paragraphIndexToSync);

    console.log("Syncing progress to server:", {
      highestParagraphIndex,
      paragraphIndexToSync,
      chunkIndex,
      bookId: currentBookId.value,
    });

    // Update progress on server
    const result = await graphqlMutation(UPDATE_PROGRESS, {
      input: {
        bookId: currentBookId.value,
        currentChunkIndex: chunkIndex,
        unlockedUntilChunkIndex: chunkIndex,
      },
    });

    console.log("Progress synced successfully:", result);
  } catch (error) {
    console.error("Failed to sync progress to server:", error);
  }
};

// Load chunks from server for mapping
const loadChunks = async () => {
  if (!currentBookId.value) {
    return;
  }

  try {
    // Load all chunks (or at least enough to map paragraphs)
    const chunksData = await graphqlQuery<{
      chunks: Array<{
        id: string;
        chunkIndex: number;
        text: string;
        wordCount: number;
        sectionIndex: number;
      }>;
    }>(GET_CHUNKS, {
      bookId: currentBookId.value,
      from: 0,
      limit: 10000, // Load enough chunks to cover all sections
    });
    serverChunks.value = chunksData.chunks || [];

    // Find the current section index based on the chapter href
    const hrefParam = route.params.id;
    const decodedHref =
      typeof hrefParam === "string"
        ? decodeURIComponent(hrefParam)
        : Array.isArray(hrefParam)
        ? decodeURIComponent(hrefParam.join("/"))
        : "";
    const normalizedHref = normalizeHref(decodedHref);

    // Find section by matching href - we need to get sections from the book
    const bookData = await graphqlQuery<{
      book: { sections: Array<{ href: string; sectionIndex: number }> };
    }>(GET_BOOK, { id: currentBookId.value });

    if (bookData.book?.sections) {
      const matchingSection = bookData.book.sections.find(
        (s) => normalizeHref(s.href) === normalizedHref
      );
      if (matchingSection) {
        currentSectionIndex.value = matchingSection.sectionIndex;
      }
    }
  } catch (error) {
    console.error("Failed to load chunks:", error);
  }
};

// Load progress from server and mark paragraphs as read
const loadProgressFromServer = async () => {
  if (!currentBookId.value) {
    return;
  }

  try {
    const progressData = await graphqlQuery<{
      progress: { unlockedUntilChunkIndex: number } | null;
    }>(GET_PROGRESS, {
      bookId: currentBookId.value,
    });

    if (progressData.progress) {
      const unlockedChunkIndex = progressData.progress.unlockedUntilChunkIndex;

      // Only mark paragraphs as read if we have a current section and chunks loaded
      if (currentSectionIndex.value !== null && serverChunks.value.length > 0) {
        // Find chunks that belong to the current section
        const sectionChunks = serverChunks.value
          .filter((c) => c.sectionIndex === currentSectionIndex.value)
          .sort((a, b) => a.chunkIndex - b.chunkIndex);

        // Find the highest chunk index in this section that is <= unlockedChunkIndex
        const highestChunkInSection = sectionChunks
          .filter((c) => c.chunkIndex <= unlockedChunkIndex)
          .sort((a, b) => b.chunkIndex - a.chunkIndex)[0];

        // If we found a chunk in this section that's <= unlockedChunkIndex,
        // map it to a paragraph index within this section
        if (highestChunkInSection) {
          // Find the index of this chunk within the section's chunks
          const chunkIndexInSection = sectionChunks.findIndex(
            (c) => c.chunkIndex === highestChunkInSection.chunkIndex
          );

          // Map chunk index in section to paragraph index
          // Use a simple approximation: chunk index in section maps to paragraph index
          // Cap at the number of paragraphs in this section
          let maxParagraphIndex = Math.min(
            chunkIndexInSection,
            paragraphs.value.length - 1
          );

          // Also check gate positions to find a better mapping
          for (const gate of gatePositions.value) {
            // If the gate's end paragraph is within reasonable range, use it
            if (gate.endParagraphIndex <= maxParagraphIndex + 5) {
              maxParagraphIndex = Math.max(
                maxParagraphIndex,
                gate.endParagraphIndex
              );
            }
          }

          // Cap at actual paragraph count
          maxParagraphIndex = Math.min(
            maxParagraphIndex,
            paragraphs.value.length - 1
          );

          // Mark paragraphs as read up to maxParagraphIndex
          for (
            let i = 0;
            i <= maxParagraphIndex && i < paragraphs.value.length;
            i++
          ) {
            readParagraphIndices.value.add(i);
          }

          // Mark corresponding display items as read
          let paragraphCount = 0;
          for (
            let displayItemIndex = 0;
            displayItemIndex < displayItems.value.length;
            displayItemIndex++
          ) {
            const item = displayItems.value[displayItemIndex];
            if (item && item.type === "paragraph") {
              if (paragraphCount <= maxParagraphIndex) {
                readItems.value.add(displayItemIndex);
              }
              paragraphCount++;
            }
          }
        } else {
          // No chunks in this section are unlocked yet, don't mark anything as read
        }
      }
    }
  } catch (error) {
    console.error("Failed to load progress from server:", error);
  }
};

const loadChapterContent = async () => {
  if (!import.meta.client) return;

  const hrefParam = route.params.id;
  const decodedHref =
    typeof hrefParam === "string"
      ? decodeURIComponent(hrefParam)
      : Array.isArray(hrefParam)
      ? decodeURIComponent(hrefParam.join("/"))
      : "";

  const normalizedHref = normalizeHref(decodedHref);

  // Use the mapping to find the actual spine URL
  const spineUrl = tocToSpineMap.value[normalizedHref] || normalizedHref;

  // Try multiple lookup methods
  let content = chapterContent.value[spineUrl];

  // If not found, try the normalized href directly
  if (!content) {
    content = chapterContent.value[normalizedHref];
  }

  // If still not found, try without leading slash
  if (!content && spineUrl.startsWith("/")) {
    content = chapterContent.value[spineUrl.substring(1)];
  }

  // If still not found, try with leading slash
  if (!content && !spineUrl.startsWith("/")) {
    content = chapterContent.value["/" + spineUrl];
  }

  if (content) {
    const extracted = extractParagraphs(content);
    paragraphs.value = extracted;

    // Initialize reader state with chapter title from ToC
    const tocItem = toc.value?.find((item: { href: string; label: string }) => {
      const itemNormalizedHref = normalizeHref(item.href);
      return itemNormalizedHref === normalizedHref;
    });

    if (tocItem) {
      readerState.value = {
        section_title: tocItem.label,
        entities: [],
        prior_summary: undefined,
      };
    }

    // Pre-calculate all gate positions
    precalculateGates();

    // Load chunks and progress from server
    await loadChunks();
    await loadProgressFromServer();

    // Generate questions for first gate immediately
    if (gatePositions.value.length > 0) {
      const firstGate = gatePositions.value[0];
      if (
        firstGate &&
        !generatedQuestions.value.has(0) &&
        !loadingQuestions.value.has(0)
      ) {
        generateQuestionsForGate(
          0,
          firstGate.chunks,
          firstGate.wordCount,
          firstGate.endParagraphIndex
        );
      }
    }
  } else {
    // Log debug info
    console.log("Chapter loading debug:", {
      normalizedHref,
      spineUrl,
      hasChapterContent: Object.keys(chapterContent.value).length > 0,
      availableKeys: Object.keys(chapterContent.value).slice(0, 5),
      tocToSpineMapKeys: Object.keys(tocToSpineMap.value).slice(0, 5),
    });

    if (Object.keys(chapterContent.value).length > 0) {
      // Only warn if we have some content but not this specific chapter
      console.warn(
        "Chapter content not found for href:",
        normalizedHref,
        "spineUrl:",
        spineUrl
      );
      console.log("Available keys:", Object.keys(chapterContent.value));
      console.log("TocToSpineMap:", tocToSpineMap.value);
    }
  }
};

onMounted(async () => {
  if (import.meta.client) {
    // Wait for book to be loaded if it's being initialized
    const { initializeBook } = useEpubState();
    await initializeBook();

    // Wait a bit for reactive state to update
    await nextTick();

    // Try to load immediately if content is already available
    if (Object.keys(chapterContent.value).length > 0) {
      loadChapterContent();
      return;
    }

    // Watch for chapterContent to be available
    let stopWatcher: (() => void) | null = null;
    let hasLoaded = false;

    stopWatcher = watch(
      () => Object.keys(chapterContent.value).length,
      (length) => {
        if (length > 0 && !hasLoaded) {
          hasLoaded = true;
          loadChapterContent();
          if (stopWatcher) {
            stopWatcher();
          }
        }
      },
      { immediate: true }
    );

    // Fallback timeout - try to load even if watcher doesn't trigger
    const timeoutId = setTimeout(() => {
      if (!hasLoaded) {
        hasLoaded = true;
        if (stopWatcher) {
          stopWatcher();
        }
        loadChapterContent();
      }
    }, 5000);

    // Cleanup on unmount
    onUnmounted(() => {
      if (stopWatcher) {
        stopWatcher();
      }
      clearTimeout(timeoutId);
    });
  }
});

// Watch for route changes
watch(
  () => route.params.id,
  async () => {
    paragraphs.value = [];
    readItems.value.clear();
    readParagraphIndices.value.clear();
    currentSectionIndex.value = null; // Reset section index on route change
    // Wait for content to be available
    await nextTick();
    if (Object.keys(chapterContent.value).length > 0) {
      loadChapterContent();
    } else {
      // Wait for content to load
      const unwatch = watch(
        () => Object.keys(chapterContent.value).length,
        (length) => {
          if (length > 0) {
            loadChapterContent();
            unwatch();
          }
        },
        { immediate: true }
      );
    }
  }
);
</script>

<style scoped>
.chapter-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  background-color: #f9fafb;
}

.chapter-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

.scroll-container {
  height: 100vh;
  overflow-y: scroll;
  scroll-snap-type: y mandatory;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  /* Hide scrollbar */
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
  position: relative;
}

.scroll-container::-webkit-scrollbar {
  display: none; /* Chrome, Safari, Opera */
}

.scroll-content {
  /* Content height is set dynamically: displayItems.length * 100vh */
  display: flex;
  flex-direction: column;
}

.paragraph-snap {
  scroll-snap-align: center;
  scroll-snap-stop: always;
  height: 100vh;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  box-sizing: border-box;
  flex-shrink: 0;
}

.paragraph-content {
  max-width: 42rem;
  width: 100%;
  text-align: left;
  font-size: 1.125rem;
  line-height: 1.75rem;
  color: #1f2937;
}

.paragraph-content :deep(p) {
  margin-bottom: 1rem;
}

.paragraph-content :deep(p:last-child) {
  margin-bottom: 0;
}

.paragraph-content :deep(h1),
.paragraph-content :deep(h2),
.paragraph-content :deep(h3),
.paragraph-content :deep(h4),
.paragraph-content :deep(h5),
.paragraph-content :deep(h6) {
  margin-bottom: 1rem;
  font-weight: 600;
}

.paragraph-content :deep(blockquote) {
  border-left: 4px solid #e5e7eb;
  padding-left: 1rem;
  margin: 1rem 0;
  font-style: italic;
}

.paragraph-content :deep(ul),
.paragraph-content :deep(ol) {
  margin: 1rem 0;
  padding-left: 2rem;
}

.paragraph-content :deep(li) {
  margin-bottom: 0.5rem;
}

.button-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.continue-button {
  padding: 1rem 2rem;
  font-size: 1.125rem;
  font-weight: 600;
  color: white;
  background-color: #3b82f6;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: background-color 0.2s;
}

.continue-button:hover {
  background-color: #2563eb;
}

.continue-button:active {
  background-color: #1d4ed8;
}

.continue-button.button-disabled {
  background-color: #9ca3af;
  cursor: not-allowed;
}

.continue-button.button-disabled:hover {
  background-color: #9ca3af;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 2rem;
}

.loading-text {
  font-size: 1.125rem;
  color: #6b7280;
  text-align: center;
  margin-bottom: 0.5rem;
}

.loading-hint {
  font-size: 0.875rem;
  color: #9ca3af;
  text-align: center;
}

.chapter-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

.scroll-indicator {
  position: fixed;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 100;
  pointer-events: none;
}

.indicator-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #d1d5db;
  transition: all 0.2s;
}

.indicator-dot.indicator-read {
  background-color: #6b7280;
}

.indicator-dot.indicator-current {
  width: 12px;
  height: 12px;
  background-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}

/* Question colors take priority */
.indicator-dot.indicator-question-correct {
  background-color: #10b981 !important;
}

.indicator-dot.indicator-question-correct.indicator-current {
  width: 12px;
  height: 12px;
  box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2);
}

.indicator-dot.indicator-question-incorrect {
  background-color: #ef4444 !important;
}

.indicator-dot.indicator-question-incorrect.indicator-current {
  width: 12px;
  height: 12px;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2);
}

.indicator-dot.indicator-question-unanswered {
  background-color: #fbbf24;
}

.indicator-dot.indicator-question-unanswered.indicator-current {
  width: 12px;
  height: 12px;
  box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.2);
}

.breadcrumbs-container {
  position: fixed;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10000000;
  pointer-events: none;
}

.breadcrumbs-track {
  position: relative;
  height: 90vh;
}

.breadcrumb-dot {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: 8px;
  height: 2px;
  background-color: #d1d5db;
  transition: all 0.2s ease;
  pointer-events: none;
}

.breadcrumb-dot.breadcrumb-read {
  background-color: #6b7280;
}

.breadcrumb-dot.breadcrumb-current {
  width: 12px;
  height: 2px;
  background-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
}
</style>
