/**
 * Bay Area gazetteer. Enough to resolve the cities, counties, ZIPs, and
 * nicknames people actually type; replace with a geocoder later.
 */
import type { Location } from "../types";

export interface Place extends Required<Pick<Location, "city" | "county" | "lat" | "lng">> {
  aliases?: string[];
  /** Full 5-digit ZIPs or 3-digit prefixes. Longer entries take priority. */
  zipPrefixes?: string[];
}

export const PLACES: Place[] = [
  // Santa Clara County
  { city: "San Jose", county: "Santa Clara County", lat: 37.3382, lng: -121.8863, aliases: ["SJ", "San José"], zipPrefixes: ["951"] },
  { city: "Santa Clara", county: "Santa Clara County", lat: 37.3541, lng: -121.9552, zipPrefixes: ["95050", "95051", "95053", "95054"] },
  { city: "Sunnyvale", county: "Santa Clara County", lat: 37.3688, lng: -122.0363, zipPrefixes: ["94085", "94086", "94087", "94089"] },
  { city: "Mountain View", county: "Santa Clara County", lat: 37.3861, lng: -122.0839, aliases: ["Mtn View"], zipPrefixes: ["94040", "94041", "94043"] },
  { city: "Los Altos", county: "Santa Clara County", lat: 37.3852, lng: -122.1141, zipPrefixes: ["94022", "94024"] },
  { city: "Los Altos Hills", county: "Santa Clara County", lat: 37.3797, lng: -122.1375 },
  { city: "Palo Alto", county: "Santa Clara County", lat: 37.4419, lng: -122.143, zipPrefixes: ["94301", "94304", "94306"] },
  { city: "Stanford", county: "Santa Clara County", lat: 37.4275, lng: -122.1697, zipPrefixes: ["94305", "94309"] },
  { city: "Cupertino", county: "Santa Clara County", lat: 37.323, lng: -122.0322, zipPrefixes: ["95014"] },
  { city: "Campbell", county: "Santa Clara County", lat: 37.2872, lng: -121.95, zipPrefixes: ["95008"] },
  { city: "Los Gatos", county: "Santa Clara County", lat: 37.2358, lng: -121.9624, zipPrefixes: ["95030", "95031", "95032", "95033"] },
  { city: "Saratoga", county: "Santa Clara County", lat: 37.2638, lng: -122.023, zipPrefixes: ["95070"] },
  { city: "Milpitas", county: "Santa Clara County", lat: 37.4323, lng: -121.8996, zipPrefixes: ["95035", "95036"] },
  { city: "Morgan Hill", county: "Santa Clara County", lat: 37.1305, lng: -121.6544, zipPrefixes: ["95037", "95038"] },
  { city: "Gilroy", county: "Santa Clara County", lat: 37.0058, lng: -121.5683, zipPrefixes: ["95020", "95021"] },
  // San Mateo County
  { city: "East Palo Alto", county: "San Mateo County", lat: 37.4688, lng: -122.1411, aliases: ["EPA"], zipPrefixes: ["94303"] },
  { city: "Menlo Park", county: "San Mateo County", lat: 37.453, lng: -122.1817, zipPrefixes: ["94025", "94026"] },
  { city: "Atherton", county: "San Mateo County", lat: 37.4613, lng: -122.1977, zipPrefixes: ["94027"] },
  { city: "Redwood City", county: "San Mateo County", lat: 37.4852, lng: -122.2364, aliases: ["RWC"], zipPrefixes: ["94061", "94062", "94063", "94064", "94065"] },
  { city: "San Carlos", county: "San Mateo County", lat: 37.5072, lng: -122.2605, zipPrefixes: ["94070"] },
  { city: "Belmont", county: "San Mateo County", lat: 37.5202, lng: -122.2758, zipPrefixes: ["94002"] },
  { city: "Foster City", county: "San Mateo County", lat: 37.5585, lng: -122.2711, zipPrefixes: ["94404"] },
  { city: "San Mateo", county: "San Mateo County", lat: 37.563, lng: -122.3255, zipPrefixes: ["94401", "94402", "94403"] },
  { city: "Burlingame", county: "San Mateo County", lat: 37.5841, lng: -122.3661, zipPrefixes: ["94010"] },
  { city: "Millbrae", county: "San Mateo County", lat: 37.5985, lng: -122.3872, zipPrefixes: ["94030"] },
  { city: "San Bruno", county: "San Mateo County", lat: 37.6305, lng: -122.4111, zipPrefixes: ["94066"] },
  { city: "South San Francisco", county: "San Mateo County", lat: 37.6547, lng: -122.4077, aliases: ["South SF", "South City", "SSF"], zipPrefixes: ["94080"] },
  { city: "Daly City", county: "San Mateo County", lat: 37.6879, lng: -122.4702, zipPrefixes: ["94014", "94015", "94016"] },
  { city: "Pacifica", county: "San Mateo County", lat: 37.6138, lng: -122.4869, zipPrefixes: ["94044"] },
  { city: "Half Moon Bay", county: "San Mateo County", lat: 37.4636, lng: -122.4286, zipPrefixes: ["94019"] },
  // San Francisco
  { city: "San Francisco", county: "San Francisco County", lat: 37.7749, lng: -122.4194, aliases: ["SF", "San Fran", "Frisco"], zipPrefixes: ["941"] },
  // Alameda County
  { city: "Oakland", county: "Alameda County", lat: 37.8044, lng: -122.2712, zipPrefixes: ["946"] },
  { city: "Berkeley", county: "Alameda County", lat: 37.8716, lng: -122.2727, zipPrefixes: ["947"] },
  { city: "Fremont", county: "Alameda County", lat: 37.5485, lng: -121.9886, zipPrefixes: ["94536", "94537", "94538", "94539", "94555"] },
  { city: "Hayward", county: "Alameda County", lat: 37.6688, lng: -122.0808, zipPrefixes: ["94540", "94541", "94542", "94543", "94544", "94545"] },
  { city: "Union City", county: "Alameda County", lat: 37.5934, lng: -122.0439, zipPrefixes: ["94587"] },
  { city: "Newark", county: "Alameda County", lat: 37.5297, lng: -122.0402, zipPrefixes: ["94560"] },
  { city: "San Leandro", county: "Alameda County", lat: 37.7249, lng: -122.1561, zipPrefixes: ["94577", "94578", "94579"] },
  { city: "Alameda", county: "Alameda County", lat: 37.7652, lng: -122.2416, zipPrefixes: ["94501", "94502"] },
  // Santa Cruz County
  { city: "Santa Cruz", county: "Santa Cruz County", lat: 36.9741, lng: -122.0308, zipPrefixes: ["950"] },
];

const COUNTY_NAMES = Array.from(new Set(PLACES.map((p) => p.county)));

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
}

/** Resolve free text (city, county, ZIP, nickname) to a Location. */
export function resolvePlace(text: string): Location | undefined {
  const t = text.toLowerCase().replace(/[’‘]/g, "'");

  // 1. ZIP (California ZIPs start with 9). Ignore numbers that look like money.
  const zipMatch = t.match(/(?<![$\d,.])\b(9[0-6]\d{3})\b(?!\s*(?:\/|a |per |an? month|k\b|,\d))/);
  if (zipMatch) {
    const zip = zipMatch[1];
    let best: { place: Place; len: number } | undefined;
    for (const place of PLACES) {
      for (const prefix of place.zipPrefixes ?? []) {
        if (zip.startsWith(prefix) && (!best || prefix.length > best.len)) best = { place, len: prefix.length };
      }
    }
    if (best) return { city: best.place.city, county: best.place.county, zip, lat: best.place.lat, lng: best.place.lng };
  }

  // 2. County names first, so "Santa Clara County" does not resolve to the city.
  for (const county of COUNTY_NAMES) {
    const base = county.replace(/ county$/i, "");
    if (new RegExp(`\\b${escape(base.toLowerCase())}\\s+county\\b`).test(t)) return { county };
  }

  // 3. City names and nicknames, longest first so "Los Altos Hills" beats "Los Altos".
  const candidates = PLACES.flatMap((place) => [place.city, ...(place.aliases ?? [])].map((name) => ({ place, name })))
    .sort((a, b) => b.name.length - a.name.length);
  for (const { place, name } of candidates) {
    const isShort = name.length <= 3; // nicknames like SF, SJ, EPA
    if (isShort) {
      // Accept the uppercase form anywhere, or lowercase only in a place-like slot ("in sj", "sj,").
      const upper = new RegExp(`(?<![A-Za-z])${escape(name)}(?![A-Za-z])`).test(text);
      const lowerInSlot = new RegExp(`\\b(?:in|to|from|near|around|at|of) ${escape(name.toLowerCase())}(?![a-z])`).test(t);
      if (!upper && !lowerInSlot) continue;
      return { city: place.city, county: place.county, lat: place.lat, lng: place.lng };
    }
    if (new RegExp(`\\b${escape(name.toLowerCase())}\\b`).test(t)) {
      return { city: place.city, county: place.county, lat: place.lat, lng: place.lng };
    }
  }

  return undefined;
}
