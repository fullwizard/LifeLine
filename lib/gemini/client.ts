/**
 * Optional Gemini client. Returns null when GEMINI_API_KEY is unset so the
 * rest of the app falls back to deterministic stubs.
 */
import { GoogleGenAI } from "@google/genai";

// gemini-2.5-flash is closed to new API keys (404), so new keys need a current model.
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";

/** Longest we wait before giving up and using the offline fallback. Measured on gemini-3.8-flash: parsing ~4-6s, writing a full plan ~11-38s. */
export const PARSE_TIMEOUT_MS = 20_000;
export const EXPLAIN_TIMEOUT_MS = 60_000;

let cached: GoogleGenAI | null | undefined;

export function getGeminiClient(): GoogleGenAI | null {
  if (cached !== undefined) return cached;
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  cached = apiKey ? new GoogleGenAI({ apiKey }) : null;
  return cached;
}

export function geminiEnabled(): boolean {
  return getGeminiClient() !== null;
}

/** Generate JSON from a prompt; throws on any failure (including a timeout) so callers can fall back. */
export async function generateJson<T>(prompt: string, schema: object, timeoutMs: number): Promise<T> {
  const client = getGeminiClient();
  if (!client) throw new Error("Gemini is not configured");
  const res = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0.2,
      httpOptions: { timeout: timeoutMs },
    },
  });
  const text = res.text;
  if (!text) throw new Error("Gemini returned an empty response");
  return JSON.parse(text) as T;
}
