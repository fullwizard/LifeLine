/**
 * Service-area evaluation. Pure functions over strings — no I/O.
 *
 * Service area entries are one of:
 *   "US"                 national
 *   "WA"                 state
 *   "King County, WA"    county
 *   "Seattle, WA"        city
 */
import type { Location } from "../types";

export type AreaMatch = "match" | "mismatch" | "unknown";

type ParsedArea =
  | { kind: "national" }
  | { kind: "state"; state: string }
  | { kind: "county"; county: string; state: string }
  | { kind: "city"; city: string; state: string };

const NATIONAL = new Set(["us", "usa", "national", "nationwide", "united states"]);

export function norm(s: string | undefined): string {
  return (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function normCounty(s: string): string {
  return norm(s).replace(/\s+county$/, "");
}

export function parseArea(entry: string): ParsedArea {
  const n = norm(entry);
  if (NATIONAL.has(n)) return { kind: "national" };
  const parts = n.split(",").map((p) => p.trim());
  if (parts.length === 1) {
    return { kind: "state", state: parts[0] };
  }
  const state = parts[parts.length - 1];
  const place = parts.slice(0, -1).join(", ");
  if (/\bcounty$/.test(place)) {
    return { kind: "county", county: normCounty(place), state };
  }
  return { kind: "city", city: place, state };
}

/** Compare one service-area entry to a (possibly partial) user location. */
export function matchArea(entry: string, loc: Location | undefined): AreaMatch {
  const area = parseArea(entry);
  if (area.kind === "national") return "match";

  const uState = norm(loc?.state) || undefined;
  const uCounty = loc?.county ? normCounty(loc.county) : undefined;
  const uCity = norm(loc?.city) || undefined;

  if (uState && uState !== area.state) return "mismatch";

  switch (area.kind) {
    case "state":
      return uState ? "match" : "unknown";
    case "county":
      if (uCounty) return uCounty === area.county ? "match" : "mismatch";
      return "unknown";
    case "city":
      if (uCity) return uCity === area.city ? "match" : "mismatch";
      return "unknown";
  }
}

/**
 * Overall verdict across all entries: any match wins; otherwise any unknown
 * keeps the resource alive as unverified; only all-mismatch excludes.
 */
export function evaluateServiceArea(
  serviceArea: string[],
  loc: Location | undefined,
): { verdict: AreaMatch; matched?: string } {
  let sawUnknown = false;
  for (const entry of serviceArea) {
    const m = matchArea(entry, loc);
    if (m === "match") return { verdict: "match", matched: entry };
    if (m === "unknown") sawUnknown = true;
  }
  if (serviceArea.length === 0) return { verdict: "unknown" };
  return { verdict: sawUnknown ? "unknown" : "mismatch" };
}

/** True if any service-area entry is national (no meaningful distance). */
export function isNational(resource: { service_area: string[] }): boolean {
  return resource.service_area.some((e) => parseArea(e).kind === "national");
}

export function describeLocation(loc: Location | undefined): string {
  if (!loc) return "unknown location";
  const parts = [loc.city, loc.county, loc.state].filter(Boolean);
  return parts.length ? parts.join(", ") : loc.zip ? `ZIP ${loc.zip}` : "unknown location";
}
