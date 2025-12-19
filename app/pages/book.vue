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
            <ul v-else class="space-y-2">
              <li v-for="item in toc" :key="item.id" class="text-gray-700 py-1">
                <NuxtLink
                  :to="`/chapter/${encodeURIComponent(normalizeHref(item.href))}`"
                  class="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                >
                  {{ item.label }}
                </NuxtLink>
              </li>
            </ul>
          </div>

          <div class="pt-4 border-t border-gray-200">
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
const { metadata, toc } = useEpubState();

// Normalize href: remove fragment and ensure leading slash
const normalizeHref = (href: string): string => {
  const withoutFragment = href.split('#')[0];
  return withoutFragment.startsWith('/') ? withoutFragment : `/${withoutFragment}`;
};
</script>
