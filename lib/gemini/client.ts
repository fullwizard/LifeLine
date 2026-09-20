/**
 * Optional Gemini client. Returns null when GEMINI_API_KEY is unset so the
 * rest of the app falls back to deterministic stubs.
 */
import { GoogleGenAI } from "@google/genai";

export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

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

/** Generate JSON from a prompt; throws on any failure so callers can fall back. */
export async function generateJson<T>(prompt: string, schema: object): Promise<T> {
  const client = getGeminiClient();
  if (!client) throw new Error("Gemini is not configured");
  const res = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0.2,
    },
  });
  const text = res.text;
  if (!text) throw new Error("Gemini returned an empty response");
  return JSON.parse(text) as T;
}
