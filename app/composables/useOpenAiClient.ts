// Client-side composable for OpenAI API key validation

export function useOpenAi() {
  const validateKey = async (apiKey: string): Promise<boolean> => {
    if (import.meta.server) {
      return false; // Don't validate on server
    }
    try {
      const response = await $fetch<{ valid: boolean }>('/api/openai/validate', {
        method: 'POST',
        body: { apiKey },
      });
      return response.valid === true;
    } catch (error) {
      console.error('Failed to validate API key:', error);
      return false;
    }
  };

  return {
    validateKey,
  };
}

