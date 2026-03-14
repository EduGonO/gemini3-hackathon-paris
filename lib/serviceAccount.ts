// lib/serviceAccount.ts
// Loads API credentials and service account from environment variables.
// NEVER hardcode credentials here — always use environment variables.

export interface ServiceAccount {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  [key: string]: string;
}

/**
 * Load Google service account from the GOOGLE_SERVICE_ACCOUNT env var.
 * Expects the full service account JSON as a string.
 */
export function getServiceAccount(): ServiceAccount {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT environment variable is not set. " +
      "Add the service account JSON as a string to your .env.local file."
    );
  }
  try {
    return JSON.parse(raw) as ServiceAccount;
  } catch {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT is not valid JSON. " +
      "Ensure you pasted the full service account JSON as a single-line string."
    );
  }
}

/**
 * Get Gemini API key. Checks multiple env var names for flexibility.
 * Priority: GEMINI_API_KEY → GEMINI_API → gemini_api
 */
export function getGeminiApiKey(): string {
  const key =
    process.env.GEMINI_API_KEY ??
    process.env.GEMINI_API ??
    process.env.gemini_api;
  if (!key) {
    throw new Error(
      "Gemini API key not found. Set GEMINI_API_KEY in your .env.local file. " +
      "Get a key at https://aistudio.google.com/app/apikey"
    );
  }
  return key;
}

/**
 * Get OpenAI API key. Checks OPENAI_KEY and OPENAI_API_KEY.
 * Returns null if not configured (OpenAI is optional — used as fallback).
 */
export function getOpenAiKey(): string | null {
  return process.env.OPENAI_KEY ?? process.env.OPENAI_API_KEY ?? null;
}
