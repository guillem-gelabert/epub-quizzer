import type { Paragraph, Section } from "~/utils/types";

const MIN_WORDS = 60;
const MAX_WORDS = 120;
const TARGET_WORDS = 90;

/**
 * Count words in text (tokenized by whitespace, basic punctuation stripping)
 */
export function countWords(text: string): number {
  return text
    .trim()
    .replace(/[^\w\s]/g, " ") // Replace punctuation with spaces
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

/**
 * Segment text into sentences using heuristic approach
 */
export function segmentSentences(text: string): string[] {
  // Common abbreviations that shouldn't end sentences
  const abbreviations = new Set([
    "mr",
    "mrs",
    "ms",
    "dr",
    "prof",
    "sr",
    "jr",
    "vs",
    "etc",
    "e.g",
    "i.e",
    "a.m",
    "p.m",
    "am",
    "pm",
    "vol",
    "no",
    "pp",
    "ed",
    "eds",
    "inc",
    "ltd",
    "corp",
    "co",
  ]);

  const sentences: string[] = [];
  let current = "";
  let i = 0;

  while (i < text.length) {
    const char = text[i];
    current += char;

    // Check for sentence-ending punctuation
    if (/[.!?]/.test(char)) {
      // Look ahead to see if it's really the end of a sentence
      let nextCharIndex = i + 1;
      while (
        nextCharIndex < text.length &&
        /\s/.test(text[nextCharIndex] || "")
      ) {
        nextCharIndex++;
      }

      if (nextCharIndex < text.length) {
        const nextChar = text[nextCharIndex];
        if (!nextChar) {
          sentences.push(current.trim());
          break;
        }
        // If next char is uppercase or end of string, likely sentence end
        if (/[A-Z]/.test(nextChar) || nextCharIndex === text.length - 1) {
          // Check if the word before punctuation is an abbreviation
          const wordBefore = current
            .trim()
            .split(/\s+/)
            .pop()
            ?.toLowerCase()
            .replace(/[.!?]$/, "");
          if (wordBefore && abbreviations.has(wordBefore)) {
            i++;
            continue;
          }

          sentences.push(current.trim());
          current = "";
          i = nextCharIndex;
          continue;
        }
      } else {
        // End of text
        sentences.push(current.trim());
        break;
      }
    }

    i++;
  }

  // Add any remaining text
  if (current.trim()) {
    sentences.push(current.trim());
  }

  return sentences.filter((s) => s.length > 0);
}

/**
 * Split a long paragraph into multiple chunks
 */
function splitLongParagraph(text: string, sentences: string[]): string[] {
  const totalWords = countWords(text);
  const sentenceWords = sentences.map((s) => countWords(s));

  // Single sentence case
  if (sentences.length === 1) {
    if (totalWords <= MAX_WORDS) {
      return [text];
    }
    // Try to split at clause boundaries (commas, semicolons)
    const parts = text.split(/([,;]+\s+)/);
    const clauses: string[] = [];
    for (let i = 0; i < parts.length; i += 2) {
      if (parts[i]) {
        clauses.push(parts[i] + (parts[i + 1] || ""));
      }
    }

    if (clauses.length > 1) {
      const clauseWords = clauses.map((c) => countWords(c));
      const cumulative: number[] = [];
      let sum = 0;
      for (const w of clauseWords) {
        sum += w;
        cumulative.push(sum);
      }

      // Find best split point near target
      let bestSplit = -1;
      let bestScore = Infinity;
      for (let i = 0; i < cumulative.length - 1; i++) {
        const first = cumulative[i];
        if (first === undefined) continue;
        const second = totalWords - first;
        if (first >= MIN_WORDS && second >= MIN_WORDS) {
          const score =
            Math.abs(first - TARGET_WORDS) + Math.abs(second - TARGET_WORDS);
          if (score < bestScore) {
            bestScore = score;
            bestSplit = i;
          }
        }
      }

      if (bestSplit >= 0) {
        const firstPart = clauses.slice(0, bestSplit + 1).join("");
        const secondPart = clauses.slice(bestSplit + 1).join("");
        return [firstPart.trim(), secondPart.trim()];
      }
    }
    // Last resort: split by word count
    const words = text.split(/\s+/);
    const midPoint = Math.max(
      MIN_WORDS,
      Math.min(words.length - MIN_WORDS, Math.floor(words.length / 2))
    );
    const firstPart = words.slice(0, midPoint).join(" ");
    const secondPart = words.slice(midPoint).join(" ");
    return [firstPart, secondPart];
  }

  // Multiple sentences case
  const cumulative: number[] = [];
  let sum = 0;
  for (const w of sentenceWords) {
    sum += w;
    cumulative.push(sum);
  }

  const numChunks = Math.ceil(totalWords / MAX_WORDS);
  const targetSize = Math.max(
    MIN_WORDS,
    Math.min(MAX_WORDS, Math.round(totalWords / numChunks))
  );

  const chunks: string[] = [];
  let startIndex = 0;

  for (let chunkIdx = 0; chunkIdx < numChunks - 1; chunkIdx++) {
    const targetWords = (chunkIdx + 1) * targetSize;
    const remainingChunks = numChunks - chunkIdx - 1;
    const minRemainingWords = remainingChunks * MIN_WORDS;

    // Find best split point
    let bestSplit = -1;
    let bestScore = Infinity;

    for (let i = startIndex; i < sentences.length - 1; i++) {
      const wordsUpToI = cumulative[i];
      const wordsAfterI = totalWords - cumulative[i];

      // Feasibility check
      if (wordsAfterI < minRemainingWords) {
        continue;
      }

      // Score based on target size and avoiding orphans
      const deviationFromTarget = Math.abs(wordsUpToI - targetWords);
      const createsOrphan = wordsAfterI < MIN_WORDS ? 1000 : 0;
      const distanceFromTarget = Math.abs(wordsUpToI - TARGET_WORDS);
      const score = deviationFromTarget + createsOrphan + distanceFromTarget;

      if (score < bestScore) {
        bestScore = score;
        bestSplit = i;
      }
    }

    if (bestSplit >= 0) {
      const chunkText = sentences.slice(startIndex, bestSplit + 1).join(" ");
      chunks.push(chunkText);
      startIndex = bestSplit + 1;
    } else {
      // Fallback: take remaining sentences
      break;
    }
  }

  // Add remaining sentences as last chunk
  if (startIndex < sentences.length) {
    const remainingSentences = sentences.slice(startIndex);
    const remainingText = remainingSentences.join(" ");
    const remainingWordCount = countWords(remainingText);

    // If remaining is too small and we have chunks, try to merge with last chunk
    if (remainingWordCount < MIN_WORDS && chunks.length > 0) {
      const lastChunk = chunks[chunks.length - 1];
      const mergedText = lastChunk + " " + remainingText;
      const mergedWordCount = countWords(mergedText);
      if (mergedWordCount <= MAX_WORDS) {
        chunks[chunks.length - 1] = mergedText;
      } else {
        // Can't merge, add as separate chunk
        chunks.push(remainingText);
      }
    } else {
      chunks.push(remainingText);
    }
  }

  // Final validation: ensure all chunks are reasonable
  const validatedChunks: string[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const wordCount = countWords(chunk);

    // If chunk is too small, try to merge with next
    if (wordCount < MIN_WORDS && i < chunks.length - 1) {
      const nextChunk = chunks[i + 1];
      const mergedText = chunk + " " + nextChunk;
      const mergedWordCount = countWords(mergedText);
      if (mergedWordCount <= MAX_WORDS) {
        validatedChunks.push(mergedText);
        i++; // Skip next chunk as it's merged
        continue;
      }
    }

    validatedChunks.push(chunk);
  }

  return validatedChunks.filter((c) => c.trim().length > 0);
}

/**
 * Concatenate short paragraphs within the same section
 */
function concatenateShortParagraphs(
  paragraphs: Paragraph[],
  sectionStartIndex: number,
  sectionEndIndex: number
): Paragraph[] {
  const chunks: Paragraph[] = [];
  let i = sectionStartIndex;

  while (i <= sectionEndIndex) {
    const para = paragraphs[i];
    const wordCount = countWords(para.text);
    let currentChunk = para;

    // If paragraph is in range, keep it as-is
    if (wordCount >= MIN_WORDS && wordCount <= MAX_WORDS) {
      chunks.push(currentChunk);
      i++;
      continue;
    }

    // If too short, try to concatenate with following paragraphs
    if (wordCount < MIN_WORDS) {
      let j = i + 1;
      while (j <= sectionEndIndex) {
        const nextPara = paragraphs[j];
        const nextWordCount = countWords(nextPara.text);
        const combinedWordCount = countWords(
          currentChunk.text + " " + nextPara.text
        );

        // If next para is in range, don't merge with it
        if (nextWordCount >= MIN_WORDS && nextWordCount <= MAX_WORDS) {
          break;
        }

        // If adding next would exceed max, stop
        if (combinedWordCount > MAX_WORDS) {
          break;
        }

        // Merge paragraphs
        currentChunk = {
          index: currentChunk.index,
          text: currentChunk.text + "\n\n" + nextPara.text,
          html: (currentChunk.html || "") + "\n\n" + (nextPara.html || ""),
        };
        j++;
      }

      chunks.push(currentChunk);
      i = j;
      continue;
    }

    // If too long, split it
    if (wordCount > MAX_WORDS) {
      const sentences = segmentSentences(para.text);
      const splitChunks = splitLongParagraph(para.text, sentences);
      for (let k = 0; k < splitChunks.length; k++) {
        chunks.push({
          index: para.index + k,
          text: splitChunks[k],
          html: splitChunks[k], // Simplified - could preserve HTML structure
        });
      }
      i++;
      continue;
    }

    // Should not reach here, but fallback
    chunks.push(currentChunk);
    i++;
  }

  return chunks;
}

/**
 * Simplified chunking: keep paragraphs as-is, no min/max word constraints
 * Just re-index paragraphs sequentially and update section indices accordingly
 */
export function chunkParagraphs(
  rawParagraphs: Paragraph[],
  sections: Section[]
): { chunks: Paragraph[]; updatedSections: Section[] } {
  // Simply re-index paragraphs sequentially (1:1 mapping)
  const chunks: Paragraph[] = rawParagraphs.map((para, index) => ({
    ...para,
    index,
  }));

  // Sections map 1:1 to paragraphs since we're not merging/splitting
  // Just ensure section indices are within bounds
  const updatedSections: Section[] = sections.map((section) => {
    let sectionIndex = section.start_paragraph_index;
    // Ensure index is within bounds
    if (sectionIndex < 0) {
      sectionIndex = 0;
    } else if (sectionIndex >= chunks.length) {
      sectionIndex = chunks.length > 0 ? chunks.length - 1 : 0;
    }
    return {
      ...section,
      start_paragraph_index: sectionIndex,
    };
  });

  return { chunks, updatedSections };
}
