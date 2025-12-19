<template>
  <div class="min-h-screen bg-gray-50 p-4">
    <div class="max-w-4xl mx-auto" v-html="chapterHtml"></div>
  </div>
</template>

<script setup lang="ts">
const route = useRoute();
const { toc, chapterContent, tocToSpineMap } = useEpubState();

const chapterHtml = ref<string | null>(null);

// Normalize href: remove fragment and ensure leading slash
const normalizeHref = (href: string): string => {
  const withoutFragment = href.split("#")[0] || href;
  return withoutFragment.startsWith("/")
    ? withoutFragment
    : `/${withoutFragment}`;
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
      const document = new DOMParser().parseFromString(content, "text/html");
      chapterHtml.value = document.body.innerHTML;
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
