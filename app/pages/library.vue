<template>
  <div class="min-h-screen bg-gray-50 p-4">
    <div class="max-w-2xl mx-auto">
      <h1 class="text-3xl font-bold text-gray-900 mb-8">Library</h1>

      <div
        v-if="!metadata"
        class="bg-white rounded-lg shadow-md p-8 text-center"
      >
        <p class="text-gray-600 mb-4">No book uploaded yet.</p>
        <NuxtLink
          to="/"
          class="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Upload EPUB
        </NuxtLink>
      </div>

      <div v-else class="bg-white rounded-lg shadow-md p-6">
        <div class="space-y-4">
          <div>
            <h2 class="text-xl font-semibold text-gray-900">
              {{ metadata.title }}
            </h2>
            <p class="text-gray-600 mt-1">{{ metadata.author }}</p>
          </div>

          <div class="pt-4 border-t border-gray-200">
            <NuxtLink
              to="/book"
              class="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Open book
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { metadata } = useEpubState();
</script>

