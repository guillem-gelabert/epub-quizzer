<template>
  <div class="chapter-container">
    <div
      v-if="paragraphs.length === 0"
      class="flex items-center justify-center min-h-screen"
    >
      <p class="text-gray-600">Loading chapter...</p>
    </div>
    <div v-else class="scroll-container">
      <div
        v-for="(paragraph, index) in paragraphs"
        :key="index"
        class="paragraph-snap"
      >
        <div class="paragraph-content">
          <p v-html="paragraph"></p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute();
const { toc, chapterContent, tocToSpineMap } = useEpubState();

const paragraphs = ref<string[]>([]);

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

  // Get all paragraph elements and other block elements
  const elements = doc.querySelectorAll(
    "p, div, h1, h2, h3, h4, h5, h6, blockquote, li"
  );
  const extracted: string[] = [];

  elements.forEach((el) => {
    const text = el.textContent?.trim();
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

onMounted(async () => {
  if (import.meta.client) {
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

    // Get content from chapterContent using the spine URL as key
    const content = chapterContent.value[spineUrl];

    if (content) {
      const extracted = extractParagraphs(content);
      paragraphs.value = extracted;
    } else {
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
});
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

.scroll-container {
  height: 100vh;
  overflow-y: scroll;
  scroll-snap-type: y mandatory;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
}

.paragraph-snap {
  scroll-snap-align: center;
  scroll-snap-stop: always;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  box-sizing: border-box;
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
</style>
