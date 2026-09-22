/** California gazetteer with extra coverage for the CA-16 area. */
import type { Location } from "../types";

export interface Place extends Required<Pick<Location, "city" | "county" | "lat" | "lng">> {
  aliases?: string[];
  zipPrefixes?: string[];
}

export const PLACES: Place[] = [
  { city: "San Jose", county: "Santa Clara County", lat: 37.3382, lng: -121.8863, zipPrefixes: ["951"] },
  { city: "Santa Clara", county: "Santa Clara County", lat: 37.3541, lng: -121.9552, zipPrefixes: ["95050", "95051", "95053", "95054"] },
  { city: "Sunnyvale", county: "Santa Clara County", lat: 37.3688, lng: -122.0363, zipPrefixes: ["94085", "94086", "94087", "94089"] },
  { city: "Mountain View", county: "Santa Clara County", lat: 37.3861, lng: -122.0839, zipPrefixes: ["94040", "94041", "94043"] },
  { city: "Milpitas", county: "Santa Clara County", lat: 37.4323, lng: -121.8996, zipPrefixes: ["95035", "95036"] },
  { city: "Palo Alto", county: "Santa Clara County", lat: 37.4419, lng: -122.143, zipPrefixes: ["94301", "94303", "94304", "94305", "94306", "94309"] },
  { city: "East Palo Alto", county: "San Mateo County", lat: 37.4688, lng: -122.1411, aliases: ["EPA"], zipPrefixes: ["94303"] },
  { city: "Menlo Park", county: "San Mateo County", lat: 37.453, lng: -122.1817, zipPrefixes: ["94025", "94026"] },
  { city: "Redwood City", county: "San Mateo County", lat: 37.4852, lng: -122.2364, zipPrefixes: ["94002", "94061", "94062", "94063", "94065"] },
  { city: "San Mateo", county: "San Mateo County", lat: 37.563, lng: -122.3255, zipPrefixes: ["94401", "94402", "94403", "94404"] },
  { city: "Daly City", county: "San Mateo County", lat: 37.6879, lng: -122.4702, zipPrefixes: ["94014", "94015", "94016"] },
  { city: "South San Francisco", county: "San Mateo County", lat: 37.6547, lng: -122.4077, zipPrefixes: ["94044", "94080"] },
];

const COUNTIES = Array.from(new Map(PLACES.map((place) => [place.county, place])).values());

export function resolvePlace(text: string): Location | undefined {
  const normalized = text.toLowerCase();
  const zip = normalized.match(/\b(\d{5})\b/)?.[1];
  if (zip) {
    const place = PLACES.find((candidate) => candidate.zipPrefixes?.some((prefix) => zip.startsWith(prefix)));
    if (place) return { city: place.city, county: place.county, zip, lat: place.lat, lng: place.lng };
  }
  for (const place of [...PLACES].sort((a, b) => b.city.length - a.city.length)) {
    const names = [place.city, ...(place.aliases ?? [])].map((name) => name.toLowerCase());
    if (names.some((name) => new RegExp(`\\b${name.replace(/\s+/g, "\\s+")}\\b`).test(normalized))) {
      return { city: place.city, county: place.county, lat: place.lat, lng: place.lng };
    }
  }
  for (const place of COUNTIES) {
    const base = place.county.replace(/ county$/i, "").toLowerCase();
    if (new RegExp(`\\b${base}\\s+county\\b`).test(normalized)) return { county: place.county };
  }
  return undefined;
}
