<template>
  <div class="min-h-screen bg-gray-50 p-4">
    <div class="max-w-2xl mx-auto">
      <h1 class="text-3xl font-bold text-gray-900 mb-8">Book</h1>

      <div
        v-if="!metadata"
        class="bg-white rounded-lg shadow-md p-8 text-center"
      >
        <p class="text-gray-600 mb-4">No book loaded.</p>
        <NuxtLink
          to="/library"
          class="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Back to Library
        </NuxtLink>
      </div>

      <div v-else class="bg-white rounded-lg shadow-md p-6">
        <div class="space-y-6">
          <div>
            <h2 class="text-xl font-semibold text-gray-900">
              {{ metadata.title }}
            </h2>
            <p class="text-gray-600 mt-1">{{ metadata.author }}</p>
          </div>

          <div class="pt-4 border-t border-gray-200">
            <h3 class="text-lg font-semibold text-gray-900 mb-4">
              Table of Contents
            </h3>
            <div v-if="!toc || toc.length === 0" class="text-gray-600">
              <p>No table of contents available.</p>
            </div>
            <nav v-else class="toc-container">
              <ul class="toc-list">
                <li v-for="item in toc" :key="item.id" class="toc-item">
                  <NuxtLink
                    v-if="item.href && !item.subitems?.length"
                    :to="`/chapter/${encodeURIComponent(
                      normalizeHref(item.href)
                    )}`"
                    class="toc-link"
                  >
                    {{ item.label || "Untitled" }}
                  </NuxtLink>
                  <span v-else class="toc-label">{{
                    item.label || "Untitled"
                  }}</span>
                  <ul
                    v-if="item.subitems && item.subitems.length > 0"
                    class="toc-sublist"
                  >
                    <li
                      v-for="subitem in item.subitems"
                      :key="subitem.id"
                      class="toc-subitem"
                    >
                      <NuxtLink
                        v-if="subitem.href"
                        :to="`/chapter/${encodeURIComponent(
                          normalizeHref(subitem.href)
                        )}`"
                        class="toc-link toc-sublink"
                      >
                        {{ subitem.label || "Untitled" }}
                      </NuxtLink>
                      <span v-else class="toc-label">{{
                        subitem.label || "Untitled"
                      }}</span>
                    </li>
                  </ul>
                </li>
              </ul>
            </nav>
          </div>

          <div class="pt-4 border-t border-gray-200 flex gap-4">
            <button
              @click="reloadBook"
              :disabled="reloading"
              class="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ reloading ? "Reloading..." : "Reload Book" }}
            </button>
            <NuxtLink
              to="/library"
              class="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to Library
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { metadata, toc, currentBookId, loadBookFromServer } = useEpubState();

const reloading = ref(false);

const reloadBook = async () => {
  if (!currentBookId.value || reloading.value) {
    return;
  }

  try {
    reloading.value = true;
    await loadBookFromServer(currentBookId.value);
  } catch (error) {
    console.error("Failed to reload book:", error);
    alert("Failed to reload book. Please try again.");
  } finally {
    reloading.value = false;
  }
};

// Normalize href: remove fragment and ensure leading slash
const normalizeHref = (href: string): string => {
  const withoutFragment = href.split("#")[0] || href;
  return withoutFragment.startsWith("/")
    ? withoutFragment
    : `/${withoutFragment}`;
};
</script>

<style scoped>
.toc-container {
  max-height: 600px;
  overflow-y: auto;
}

.toc-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.toc-item {
  margin: 0;
  padding: 0;
}

.toc-link {
  display: block;
  padding: 0.5rem 0.75rem;
  color: #2563eb;
  text-decoration: none;
  border-radius: 0.375rem;
  transition: all 0.2s ease;
  font-size: 0.9375rem;
  line-height: 1.5;
}

.toc-link:hover {
  background-color: #eff6ff;
  color: #1d4ed8;
  text-decoration: underline;
}

.toc-link:active {
  background-color: #dbeafe;
}

.toc-label {
  display: block;
  padding: 0.5rem 0.75rem;
  color: #374151;
  font-size: 0.9375rem;
  line-height: 1.5;
}

.toc-sublist {
  list-style: none;
  padding: 0;
  margin: 0;
  margin-left: 1.5rem;
  border-left: 2px solid #e5e7eb;
  padding-left: 0.75rem;
}

.toc-subitem {
  margin: 0;
  padding: 0;
}

.toc-sublink {
  color: #4b5563;
  font-size: 0.875rem;
  padding: 0.375rem 0.5rem;
}

.toc-sublink:hover {
  background-color: #f9fafb;
  color: #1f2937;
}

/* Scrollbar styling for ToC container */
.toc-container::-webkit-scrollbar {
  width: 8px;
}

.toc-container::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 4px;
}

.toc-container::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

.toc-container::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
</style>
