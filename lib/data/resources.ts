/**
 * Resource access layer. Today this reads fixtures; swap the body of
 * getResources() for a Supabase query later without touching callers.
 */
import type { Resource } from "../types";
import { MOCK_RESOURCES } from "./mockResources";

export async function getResources(): Promise<Resource[]> {
  return MOCK_RESOURCES;
}
