<template>
  <div class="min-h-screen bg-gray-50">
    <div class="max-w-2xl mx-auto p-8">
      <div class="bg-white rounded-lg shadow-lg p-8">
        <div class="mb-6">
          <NuxtLink to="/" class="text-blue-600 hover:underline">← Library</NuxtLink>
          <h1 class="text-2xl font-bold mt-4">Settings</h1>
        </div>

        <div class="space-y-6">
          <div>
            <label for="n" class="block text-sm font-medium text-gray-700 mb-2">
              Paragraphs per batch (n)
            </label>
            <input
              id="n"
              v-model.number="settings.n"
              type="number"
              min="1"
              max="20"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p class="text-sm text-gray-500 mt-1">
              Number of paragraphs to read before a quiz gate (default: 5)
            </p>
          </div>

          <div>
            <label for="question-count" class="block text-sm font-medium text-gray-700 mb-2">
              Question count
            </label>
            <input
              id="question-count"
              v-model.number="settings.question_count_preference"
              type="number"
              min="2"
              max="4"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p class="text-sm text-gray-500 mt-1">Number of questions per quiz (2-4, default: 3)</p>
          </div>

          <div>
            <label for="pass-threshold" class="block text-sm font-medium text-gray-700 mb-2">
              Pass threshold (%)
            </label>
            <input
              id="pass-threshold"
              v-model.number="settings.pass_threshold"
              type="number"
              min="0"
              max="1"
              step="0.05"
              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p class="text-sm text-gray-500 mt-1">
              Minimum score to pass quiz (0-1, default: 0.6 for 60%)
            </p>
          </div>

          <div>
            <label for="api-key" class="block text-sm font-medium text-gray-700 mb-2">
              OpenAI API Key
            </label>
            <div class="flex gap-2">
              <input
                id="api-key"
                v-model="apiKeyInput"
                :type="showApiKey ? 'text' : 'password'"
                class="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="sk-..."
              />
              <button
                type="button"
                class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                @click="showApiKey = !showApiKey"
              >
                {{ showApiKey ? 'Hide' : 'Show' }}
              </button>
            </div>
            <p class="text-sm text-gray-500 mt-1">
              Your API key is stored locally and never sent to our servers.
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                class="text-blue-600 hover:underline"
              >
                Get your API key here
              </a>
            </p>
            <div class="mt-2 flex gap-2">
              <button
                type="button"
                :disabled="isValidating"
                class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                @click="handleValidateKey"
              >
                {{ isValidating ? 'Validating...' : 'Test Key' }}
              </button>
              <button
                v-if="settings.openai_api_key"
                type="button"
                class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                @click="handleRemoveKey"
              >
                Remove Key
              </button>
            </div>
            <p
              v-if="keyValidationMessage"
              class="mt-2 text-sm"
              :class="keyValidationMessage.includes('valid') ? 'text-green-600' : 'text-red-600'"
            >
              {{ keyValidationMessage }}
            </p>
          </div>

          <div class="pt-6 border-t">
            <button
              type="button"
              class="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              @click="handleSave"
            >
              Save Settings
            </button>
          </div>

          <div class="pt-6 border-t">
            <h2 class="text-lg font-semibold mb-4 text-red-600">Danger Zone</h2>
            <button
              type="button"
              class="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              @click="handleClearAll"
            >
              Clear All Data
            </button>
            <p class="text-sm text-gray-500 mt-2">
              This will delete your EPUB, reading progress, and all settings.
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

import { useOpenAi } from '~/composables/useOpenAiClient'
import { useReadingState } from '~/composables/useReadingState'
import { useLocalStorage } from '~/composables/useLocalStorage'

const { loadSettings, saveSettings, loadBookMetadata, clearAll } = useLocalStorage()

const { validateKey } = useOpenAi()
const { reset: resetReadingState } = useReadingState()

interface Settings {
  n: number;
  question_count_preference: number;
  pass_threshold: number;
  openai_api_key: string;
}

const settings = ref<Settings>({
  n: 5,
  question_count_preference: 3,
  pass_threshold: 0.6,
  openai_api_key: '',
})

const apiKeyInput = ref('')
const showApiKey = ref(false)
const isValidating = ref(false)
const keyValidationMessage = ref('')

onMounted(() => {
  const saved = loadSettings()
  if (saved) {
    settings.value = { ...saved }
    apiKeyInput.value = saved.openai_api_key || ''
  }
})

const handleValidateKey = async () => {
  if (!apiKeyInput.value.trim()) {
    keyValidationMessage.value = 'Please enter an API key'
    return
  }

  isValidating.value = true
  keyValidationMessage.value = ''

  const isValid = await validateKey(apiKeyInput.value)
  if (isValid) {
    keyValidationMessage.value = 'API key is valid!'
    settings.value.openai_api_key = apiKeyInput.value
  } else {
    keyValidationMessage.value = 'API key is invalid. Please check and try again.'
  }

  isValidating.value = false
}

const handleRemoveKey = () => {
  if (confirm('Are you sure you want to remove your API key?')) {
    apiKeyInput.value = ''
    settings.value.openai_api_key = ''
    keyValidationMessage.value = ''
  }
}

const handleSave = () => {
  settings.value.openai_api_key = apiKeyInput.value
  saveSettings(settings.value)
  alert('Settings saved!')
}

const handleClearAll = async () => {
  if (!confirm('Are you sure you want to clear all data? This cannot be undone.')) {
    return
  }

  clearAll()
  resetReadingState()

  alert('All data cleared. Redirecting to library...')
  navigateTo('/')
}
</script>
