/**
 * Tiny gazetteer used by the keyword parser and the follow-up location
 * question. Enough to make the demo area work; expand or replace with a
 * geocoder later.
 */
import type { Location } from "../types";

export interface Place extends Required<Pick<Location, "city" | "county" | "state" | "lat" | "lng">> {
  aliases?: string[];
  zipPrefixes?: string[];
}

export const PLACES: Place[] = [
  { city: "Seattle", county: "King County", state: "WA", lat: 47.6062, lng: -122.3321, zipPrefixes: ["981"] },
  { city: "Bellevue", county: "King County", state: "WA", lat: 47.6101, lng: -122.2015, zipPrefixes: ["98004", "98005", "98006", "98007", "98008"] },
  { city: "Kent", county: "King County", state: "WA", lat: 47.3809, lng: -122.2348, zipPrefixes: ["98030", "98031", "98032", "98042"] },
  { city: "Renton", county: "King County", state: "WA", lat: 47.4829, lng: -122.2171, zipPrefixes: ["98055", "98056", "98057", "98058", "98059"] },
  { city: "Federal Way", county: "King County", state: "WA", lat: 47.3223, lng: -122.3126, zipPrefixes: ["98003", "98023"] },
  { city: "Auburn", county: "King County", state: "WA", lat: 47.3073, lng: -122.2285, zipPrefixes: ["98001", "98002", "98092"] },
  { city: "Burien", county: "King County", state: "WA", lat: 47.4704, lng: -122.3468, zipPrefixes: ["98146", "98148", "98166", "98168"] },
  { city: "Shoreline", county: "King County", state: "WA", lat: 47.7557, lng: -122.3415, zipPrefixes: ["98133", "98155", "98177"] },
  { city: "Tacoma", county: "Pierce County", state: "WA", lat: 47.2529, lng: -122.4443, zipPrefixes: ["984"] },
  { city: "Puyallup", county: "Pierce County", state: "WA", lat: 47.1854, lng: -122.2929, zipPrefixes: ["98371", "98372", "98373", "98374", "98375"] },
  { city: "Lakewood", county: "Pierce County", state: "WA", lat: 47.1718, lng: -122.5185, zipPrefixes: ["98498", "98499"] },
  { city: "Everett", county: "Snohomish County", state: "WA", lat: 47.9790, lng: -122.2021, zipPrefixes: ["982"] },
  { city: "Lynnwood", county: "Snohomish County", state: "WA", lat: 47.8209, lng: -122.3151, zipPrefixes: ["98036", "98037", "98087"] },
  { city: "Spokane", county: "Spokane County", state: "WA", lat: 47.6588, lng: -117.4260, zipPrefixes: ["992"] },
  { city: "Vancouver", county: "Clark County", state: "WA", lat: 45.6387, lng: -122.6615, zipPrefixes: ["986"] },
  { city: "Portland", county: "Multnomah County", state: "OR", lat: 45.5152, lng: -122.6784, zipPrefixes: ["972"] },
];

const COUNTIES = Array.from(new Map(PLACES.map((p) => [`${p.county}|${p.state}`, p])).values());

/** Resolve free text (city, county, ZIP, "Seattle, WA") to a Location. */
export function resolvePlace(text: string): Location | undefined {
  const t = text.toLowerCase();

  const zip = t.match(/\b(\d{5})\b/)?.[1];
  if (zip) {
    const p = PLACES.find((pl) => pl.zipPrefixes?.some((pre) => zip.startsWith(pre)));
    if (p) return { city: p.city, county: p.county, state: p.state, zip, lat: p.lat, lng: p.lng };
  }

  // Longest city names first so "Federal Way" wins over "Way".
  const byLength = [...PLACES].sort((a, b) => b.city.length - a.city.length);
  for (const p of byLength) {
    const names = [p.city, ...(p.aliases ?? [])].map((n) => n.toLowerCase());
    if (names.some((n) => new RegExp(`\\b${n.replace(/\s+/g, "\\s+")}\\b`).test(t))) {
      return { city: p.city, county: p.county, state: p.state, lat: p.lat, lng: p.lng };
    }
  }

  for (const c of COUNTIES) {
    const base = c.county.replace(/ county$/i, "").toLowerCase();
    if (new RegExp(`\\b${base}\\s+county\\b`).test(t)) {
      return { county: c.county, state: c.state };
    }
  }

  const state = t.match(/\b(wa|washington|or|oregon)\b/)?.[1];
  if (state) return { state: state.startsWith("wa") ? "WA" : "OR" };

  return undefined;
}
