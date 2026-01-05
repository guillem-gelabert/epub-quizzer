<template>
  <div class="min-h-screen bg-gray-50 p-4">
    <div class="max-w-2xl mx-auto">
      <h1 class="text-3xl font-bold text-gray-900 mb-8">Library</h1>

      <div v-if="loading" class="bg-white rounded-lg shadow-md p-8 text-center">
        <p class="text-gray-600">Loading books...</p>
      </div>

      <div v-else-if="books.length === 0" class="bg-white rounded-lg shadow-md p-8 text-center">
        <p class="text-gray-600">No books found.</p>
      </div>

      <div v-else class="space-y-4">
        <div class="bg-white rounded-lg shadow-md p-6" v-for="book in books" :key="book.id">
          <div class="flex gap-6">
            <div v-if="book.coverPath" class="flex-shrink-0">
              <img
                :src="book.coverPath"
                :alt="`Cover of ${book.title}`"
                class="w-32 h-48 object-cover rounded-lg shadow-sm"
              />
            </div>
            <div v-else class="flex-shrink-0 w-32 h-48 bg-gray-200 rounded-lg flex items-center justify-center">
              <span class="text-gray-400 text-sm">No cover</span>
            </div>
            <div class="flex-1 space-y-4">
              <div>
                <h2 class="text-xl font-semibold text-gray-900">
                  {{ book.title }}
                </h2>
                <p class="text-gray-600 mt-1">{{ book.author }}</p>
              </div>

              <div class="pt-4 border-t border-gray-200">
                <NuxtLink
                  :to="`/book`"
                  @click="selectBook(book.id)"
                  class="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Open book
                </NuxtLink>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { graphqlQuery, GET_BOOKS } from "~/composables/useGraphQL";

const { loadBookFromServer, initializeBook } = useEpubState();

const books = ref<any[]>([]);
const loading = ref(true);

const loadBooks = async () => {
  try {
    loading.value = true;
    const booksData = await graphqlQuery<{ books: any[] }>(GET_BOOKS);
    books.value = booksData.books || [];
  } catch (error) {
    console.error("Failed to load books:", error);
  } finally {
    loading.value = false;
  }
};

const selectBook = async (bookId: string) => {
  await loadBookFromServer(bookId);
};

onMounted(async () => {
  await loadBooks();
  await initializeBook();
});
</script>
