<template>
  <div>
    <OpenAIStatus />
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
const { initializeBook } = useEpubState();

onMounted(async () => {
  await initializeBook();
});
</script>
