/**
 * Turn a plan into something a map can draw honestly.
 *
 * Most records only know the county they serve, so the map shades service
 * areas and counts programs per area. A record is drawn as a pin only when it
 * carries a street address. Statewide and national programs are listed, not
 * drawn. Pure: no Leaflet, no React.
 */
import { PLACES } from "../data/places";
import { parseArea } from "../matching/location";
import type { ResourceCategory, ScoredResource, Situation } from "../types";

export interface MapResourceRef {
  id: string;
  name: string;
  rank: number;
  category: ResourceCategory;
  section: "ranked" | "related";
}

export interface MapArea {
  /** Feature name in the county GeoJSON, e.g. "San Mateo". */
  name: string;
  county: string;
  resources: MapResourceRef[];
}

export interface MapPin extends MapResourceRef {
  lat: number;
  lng: number;
  address: string;
}

export interface PlanMapData {
  areas: MapArea[];
  statewide: MapResourceRef[];
  national: MapResourceRef[];
  /** Records whose service area could not be mapped to a known county. */
  unmapped: MapResourceRef[];
  pins: MapPin[];
  user?: { lat: number; lng: number; label: string };
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Counties a service-area entry covers, as GeoJSON feature names. */
export function countiesForArea(entry: string): { kind: "national" | "state" | "counties" | "unknown"; names: string[] } {
  const area = parseArea(entry);
  if (area.kind === "national") return { kind: "national", names: [] };
  if (area.kind === "state") return { kind: "state", names: [] };
  if (area.kind === "county") {
    return { kind: "counties", names: area.county.split(/\s+and\s+/).map((c) => titleCase(c.trim())) };
  }
  const place = PLACES.find((p) => p.city.toLowerCase() === area.city);
  if (place) return { kind: "counties", names: [place.county.replace(/ County$/, "")] };
  return { kind: "unknown", names: [] };
}

export function buildPlanMapData(ranked: ScoredResource[], related: ScoredResource[], situation: Situation): PlanMapData {
  const refs: MapResourceRef[] = [
    ...ranked.map((r, i) => ({ id: r.resource.id, name: r.resource.name, rank: i + 1, category: r.resource.category, section: "ranked" as const })),
    ...related.map((r, i) => ({ id: r.resource.id, name: r.resource.name, rank: ranked.length + i + 1, category: r.resource.category, section: "related" as const })),
  ];
  const byId = new Map([...ranked, ...related].map((r) => [r.resource.id, r.resource]));

  const areaMap = new Map<string, MapArea>();
  const statewide: MapResourceRef[] = [];
  const national: MapResourceRef[] = [];
  const unmapped: MapResourceRef[] = [];
  const pins: MapPin[] = [];

  for (const ref of refs) {
    const resource = byId.get(ref.id)!;
    if (resource.address && resource.lat !== undefined && resource.lng !== undefined) {
      pins.push({ ...ref, lat: resource.lat, lng: resource.lng, address: resource.address });
    }
    let placed = false;
    for (const entry of resource.service_area) {
      const { kind, names } = countiesForArea(entry);
      if (kind === "national") {
        national.push(ref);
        placed = true;
      } else if (kind === "state") {
        statewide.push(ref);
        placed = true;
      } else if (kind === "counties") {
        for (const name of names) {
          const area = areaMap.get(name) ?? { name, county: `${name} County`, resources: [] };
          if (!area.resources.some((r) => r.id === ref.id)) area.resources.push(ref);
          areaMap.set(name, area);
        }
        placed = true;
      }
    }
    if (!placed) unmapped.push(ref);
  }

  const areas = [...areaMap.values()].sort((a, b) => b.resources.length - a.resources.length || a.name.localeCompare(b.name));

  const loc = situation.location;
  const user =
    loc?.lat !== undefined && loc.lng !== undefined
      ? { lat: loc.lat, lng: loc.lng, label: loc.city ?? loc.county ?? (loc.zip ? `ZIP ${loc.zip}` : "Your location") }
      : undefined;

  return { areas, statewide, national, unmapped, pins, user };
}
