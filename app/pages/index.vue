<template>
  <div class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div class="bg-white rounded-lg shadow-md p-8 max-w-md w-full">
      <h1 class="text-2xl font-bold text-gray-900 mb-6 text-center">
        Upload EPUB
      </h1>

      <div class="space-y-4">
        <label
          for="epub-file"
          class="block w-full border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 transition-colors"
        >
          <input
            id="epub-file"
            type="file"
            accept=".epub"
            class="hidden"
            @change="handleFileSelect"
          />
          <div class="space-y-2">
            <svg
              class="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <p class="text-sm text-gray-600">Click to select an EPUB file</p>
          </div>
        </label>

        <div v-if="isLoading" class="text-center text-gray-600">
          Loading EPUB...
        </div>
        <div
          v-if="error"
          class="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg"
        >
          <p class="text-sm text-red-800">{{ error }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { loadEpub } = useEpubState();
const isLoading = ref(false);
const error = ref<string | null>(null);

const handleFileSelect = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (!file || !file.name.endsWith(".epub")) {
    return;
  }

  isLoading.value = true;
  error.value = null;

  try {
    await loadEpub(file);
    await navigateTo("/library");
  } catch (err) {
    console.error("Error loading EPUB:", err);
    error.value =
      err instanceof Error ? err.message : "Failed to load EPUB file";
  } finally {
    isLoading.value = false;
  }
};
</script>
