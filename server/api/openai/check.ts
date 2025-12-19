import OpenAI from "openai";

export default defineEventHandler(async (event) => {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      configured: false,
      valid: false,
    };
  }

  try {
    // Try to make a minimal API call to verify the key
    const client = new OpenAI({
      apiKey,
    });

    // Make a simple request to check if the key is valid
    await client.models.list();

    return {
      configured: true,
      valid: true,
    };
  } catch (error) {
    return {
      configured: true,
      valid: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
});
