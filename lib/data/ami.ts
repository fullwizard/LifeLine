/** California AMI lookup hook; limits should come from a current official source. */
import type { Location } from "../types";

export function lookupAreaMedianIncome(loc: Location | undefined): number | undefined {
  if (!loc) return undefined;
  return undefined;
}
