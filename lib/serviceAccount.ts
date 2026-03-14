// lib/serviceAccount.ts
// Loads Google service account credentials from environment variables.
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
 * The env var should contain the full service account JSON as a string.
 * Throws a descriptive error if missing or invalid.
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
      "Ensure you've pasted the entire service account JSON as a single-line string."
    );
  }
}

/**
 * Get just the Gemini API key from env.
 */
export function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY environment variable is not set. " +
      "Get a key at https://aistudio.google.com/app/apikey"
    );
  }
  return key;
}
