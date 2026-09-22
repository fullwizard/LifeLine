import { detectCrisisIndicators } from "./safety/crisis";
import type { Situation } from "./types";

/**
 * True when the description contains a direct suicide or self-harm concern.
 * Uses the indicators the parser already attached when present, otherwise
 * screens the raw text with the same deterministic detector.
 */
export function hasImmediateSafetyConcern(situation: Pick<Situation, "rawText" | "crisisIndicators">): boolean {
  if ((situation.crisisIndicators?.length ?? 0) > 0) return true;
  return detectCrisisIndicators(situation.rawText ?? "").length > 0;
}
