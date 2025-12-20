<template>
  <div>
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
// Redirect to library on mount
onMounted(() => {
  navigateTo("/library");
});
</script>

