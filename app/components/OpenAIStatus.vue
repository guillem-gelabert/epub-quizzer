<template>
  <div
    class="openai-status"
    :class="{
      'status-valid': status === 'valid',
      'status-invalid': status === 'invalid',
      'status-unknown': status === 'unknown',
    }"
    :title="tooltip"
  >
    <div class="status-circle"></div>
  </div>
</template>

<script setup lang="ts">
const status = ref<"valid" | "invalid" | "unknown">("unknown");

const tooltip = computed(() => {
  switch (status.value) {
    case "valid":
      return "OpenAI API key is configured and valid";
    case "invalid":
      return "OpenAI API key is invalid or not working";
    case "unknown":
      return "Checking OpenAI API key status...";
  }
});

const checkStatus = async () => {
  try {
    const result = await $fetch<{
      configured: boolean;
      valid: boolean;
      error?: string;
    }>("/api/openai/check");

    if (result.configured && result.valid) {
      status.value = "valid";
    } else {
      status.value = "invalid";
    }
  } catch (error) {
    status.value = "invalid";
  }
};

onMounted(() => {
  checkStatus();
  // Recheck every 5 minutes
  const interval = setInterval(checkStatus, 5 * 60 * 1000);
  onUnmounted(() => clearInterval(interval));
});
</script>

<style scoped>
.openai-status {
  position: fixed;
  top: 1rem;
  left: 1rem;
  z-index: 1000;
  cursor: help;
}

.status-circle {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.status-valid .status-circle {
  background-color: #10b981; /* green */
}

.status-invalid .status-circle {
  background-color: #ef4444; /* red */
}

.status-unknown .status-circle {
  background-color: #f59e0b; /* amber */
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>

