<template>
  <div class="chapter-container">
    <div
      v-if="paragraphs.length === 0"
      class="flex items-center justify-center min-h-screen"
    >
      <p class="text-gray-600">Loading chapter...</p>
    </div>
    <div
      v-else
      ref="scrollContainer"
      class="scroll-container"
      :class="{ 'scroll-disabled': isScrollDisabled }"
      @scroll="handleScroll"
      @wheel="handleWheel"
      @touchmove="handleTouchMove"
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
        <div v-else-if="item.type === 'button'" class="button-container">
          <button
            v-if="item.groupIndex !== undefined"
            @click="unlockNextSection(item.groupIndex)"
            class="continue-button"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute();
const { toc, chapterContent, tocToSpineMap } = useEpubState();

const paragraphs = ref<string[]>([]);
const scrollContainer = ref<HTMLElement | null>(null);
const unlockedGroups = ref<Set<number>>(new Set([0])); // First group is always unlocked
const isScrollDisabled = ref(false);
const currentScrollPosition = ref(0);

interface DisplayItem {
  type: "paragraph" | "button";
  content?: string;
  groupIndex?: number;
}

const displayItems = computed<DisplayItem[]>(() => {
  const items: DisplayItem[] = [];
  const PARAGRAPHS_PER_GROUP = 4;

  paragraphs.value.forEach((paragraph, index) => {
    items.push({
      type: "paragraph",
      content: paragraph,
    });

    // Add button after every 4th paragraph (but not after the last paragraph)
    if (
      (index + 1) % PARAGRAPHS_PER_GROUP === 0 &&
      index < paragraphs.value.length - 1
    ) {
      const groupIndex = Math.floor((index + 1) / PARAGRAPHS_PER_GROUP);
      items.push({
        type: "button",
        groupIndex,
      });
    }
  });

  return items;
});

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

const handleScroll = () => {
  if (!scrollContainer.value || isScrollDisabled.value) {
    return;
  }

  const container = scrollContainer.value;
  const scrollTop = container.scrollTop;
  const containerHeight = container.clientHeight;
  const viewportCenter = scrollTop + containerHeight / 2;

  // Find which item is currently centered in view
  const items = container.querySelectorAll(".paragraph-snap");
  let currentItemIndex = -1;
  let minDistance = Infinity;

  items.forEach((item, index) => {
    const element = item as HTMLElement;
    const itemTop = element.offsetTop;
    const itemHeight = element.offsetHeight;
    const itemCenter = itemTop + itemHeight / 2;
    const distance = Math.abs(viewportCenter - itemCenter);

    if (distance < minDistance) {
      minDistance = distance;
      currentItemIndex = index;
    }
  });

  // Check if we're at a locked button
  if (currentItemIndex >= 0 && currentItemIndex < displayItems.value.length) {
    const currentItem = displayItems.value[currentItemIndex];
    if (
      currentItem &&
      currentItem.type === "button" &&
      currentItem.groupIndex !== undefined
    ) {
      const groupIndex = currentItem.groupIndex;
      if (!unlockedGroups.value.has(groupIndex)) {
        // Lock scrolling at this button
        isScrollDisabled.value = true;
        currentScrollPosition.value = scrollTop;

        // Prevent further scrolling
        container.style.overflow = "hidden";

        // Scroll back to the button position
        const buttonElement = items[currentItemIndex] as HTMLElement;
        if (buttonElement) {
          const buttonTop =
            buttonElement.offsetTop -
            containerHeight / 2 +
            buttonElement.offsetHeight / 2;
          container.scrollTo({
            top: buttonTop,
            behavior: "smooth",
          });
        }
      }
    }
  }
};

const handleWheel = (e: WheelEvent) => {
  if (isScrollDisabled.value) {
    e.preventDefault();
    e.stopPropagation();
  }
};

const handleTouchMove = (e: TouchEvent) => {
  if (isScrollDisabled.value) {
    e.preventDefault();
    e.stopPropagation();
  }
};

const unlockNextSection = (groupIndex: number) => {
  unlockedGroups.value.add(groupIndex);
  isScrollDisabled.value = false;

  if (scrollContainer.value) {
    scrollContainer.value.style.overflow = "scroll";
    // Allow a small scroll to continue
    setTimeout(() => {
      if (scrollContainer.value) {
        scrollContainer.value.scrollBy({
          top: 1,
          behavior: "smooth",
        });
      }
    }, 100);
  }
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
  /* Hide scrollbar */
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE and Edge */
}

.scroll-container::-webkit-scrollbar {
  display: none; /* Chrome, Safari, Opera */
}

.scroll-container.scroll-disabled {
  overflow: hidden;
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
</style>
