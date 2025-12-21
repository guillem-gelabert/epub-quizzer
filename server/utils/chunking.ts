/**
 * Utility functions for chunking text into 60-120 word units
 */

export interface ChunkData {
  text: string;
  wordCount: number;
  sourceHint?: {
    sectionIndex: number;
    elementIndex?: number;
  };
}

/**
 * Count words in a text string
 */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter((word) => word.length > 0).length;
}

/**
 * Extract plain text from HTML
 */
export function extractPlainText(html: string): string {
  // Remove script and style tags
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

  // Replace common HTML entities
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, " ");

  // Normalize whitespace
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

/**
 * Split text into chunks of 60-120 words
 */
export function chunkText(text: string, minWords: number = 60, maxWords: number = 120): ChunkData[] {
  const chunks: ChunkData[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);

  let currentChunk = "";
  let currentWordCount = 0;

  for (const sentence of sentences) {
    const sentenceWordCount = countWords(sentence);

    if (currentWordCount + sentenceWordCount > maxWords && currentWordCount >= minWords) {
      // Save current chunk and start new one
      chunks.push({
        text: currentChunk.trim(),
        wordCount: currentWordCount,
      });
      currentChunk = sentence;
      currentWordCount = sentenceWordCount;
    } else {
      // Add to current chunk
      currentChunk += (currentChunk ? " " : "") + sentence;
      currentWordCount += sentenceWordCount;
    }
  }

  // Add remaining chunk if it has content
  if (currentChunk.trim().length > 0) {
    chunks.push({
      text: currentChunk.trim(),
      wordCount: currentWordCount,
    });
  }

  // If we have chunks that are too small, merge them
  const mergedChunks: ChunkData[] = [];
  for (let i = 0; i < chunks.length; i++) {
    if (chunks[i].wordCount < minWords && i < chunks.length - 1) {
      // Merge with next chunk
      const merged = chunks[i].text + " " + chunks[i + 1].text;
      mergedChunks.push({
        text: merged.trim(),
        wordCount: chunks[i].wordCount + chunks[i + 1].wordCount,
      });
      i++; // Skip next chunk as it's been merged
    } else {
      mergedChunks.push(chunks[i]);
    }
  }

  return mergedChunks;
}

/**
 * Chunk HTML content into 60-120 word units
 */
export function chunkHtml(html: string, sectionIndex: number): ChunkData[] {
  const plainText = extractPlainText(html);
  const chunks = chunkText(plainText);

  // Add source hints
  return chunks.map((chunk, index) => ({
    ...chunk,
    sourceHint: {
      sectionIndex,
      elementIndex: index,
    },
  }));
}

