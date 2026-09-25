/**
 * Turn a plan into something a map can draw honestly.
 *
 * Most records only know the county they serve, so the map shades service
 * areas and counts programs per area. A record is drawn as a pin only when it
 * carries a street address. Statewide and national programs are listed, not
 * drawn. Pure: no Leaflet, no React.
 */
import counties from "../../data/geo/bay-area-counties.json";
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

export type DotPlacement =
  | "address" // exact: the program published a street address
  | "county" // approximate: spread within the county the program serves
  | "near_you"; // approximate: statewide/national program, clustered near the person

export interface MapDot extends MapResourceRef {
  lat: number;
  lng: number;
  placement: DotPlacement;
  /** Human-readable placement note for the popup. */
  placeLabel: string;
}

export interface PlanMapData {
  /** One dot per resource that could be placed. */
  dots: MapDot[];
  areas: MapArea[];
  statewide: MapResourceRef[];
  national: MapResourceRef[];
  /** Records whose service area could not be mapped to a known county. */
  unmapped: MapResourceRef[];
  pins: MapPin[];
  user?: { lat: number; lng: number; label: string };
}

type Ring = [number, number][];
type Geometry = { type: "Polygon"; coordinates: Ring[] } | { type: "MultiPolygon"; coordinates: Ring[][] };

/** Area-weighted centroid of the largest ring of a county feature. */
function ringCentroid(ring: Ring): { lat: number; lng: number; area: number } {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];
    const f = x0 * y1 - x1 * y0;
    a += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  a /= 2;
  if (a === 0) return { lat: ring[0][1], lng: ring[0][0], area: 0 };
  return { lng: cx / (6 * a), lat: cy / (6 * a), area: Math.abs(a) };
}

function featureCentroid(geometry: Geometry): { lat: number; lng: number } {
  const rings: Ring[] = geometry.type === "Polygon" ? [geometry.coordinates[0]] : geometry.coordinates.map((poly) => poly[0]);
  let best = ringCentroid(rings[0]);
  for (const ring of rings.slice(1)) {
    const c = ringCentroid(ring);
    if (c.area > best.area) best = c;
  }
  return { lat: best.lat, lng: best.lng };
}

const COUNTY_CENTROIDS: Record<string, { lat: number; lng: number }> = Object.fromEntries(
  (counties as unknown as { features: { properties: { name: string }; geometry: Geometry }[] }).features.map((f) => [
    f.properties.name,
    featureCentroid(f.geometry),
  ]),
);

/**
 * Where a county's people actually are. The geometric centroid of Santa Clara
 * County sits in empty hills south of San Jose, so approximate dots anchor on
 * the county seat or largest city instead, falling back to the centroid.
 */
const COUNTY_ANCHORS: Record<string, { lat: number; lng: number }> = {
  "Santa Clara": { lat: 37.3382, lng: -121.8863 }, // San Jose
  "San Mateo": { lat: 37.4852, lng: -122.2364 }, // Redwood City (county seat)
  "San Francisco": { lat: 37.7749, lng: -122.4194 },
  Alameda: { lat: 37.8044, lng: -122.2712 }, // Oakland
  "Contra Costa": { lat: 37.978, lng: -122.031 }, // Concord
  Marin: { lat: 37.9735, lng: -122.5311 }, // San Rafael
  "Santa Cruz": { lat: 36.9741, lng: -122.0308 },
};

export function countyCentroid(name: string): { lat: number; lng: number } | undefined {
  return COUNTY_ANCHORS[name] ?? COUNTY_CENTROIDS[name];
}

/**
 * Deterministic sunflower spread so dots at the same approximate location
 * never sit on top of each other. Step ≈ 1.2 km; 25 dots fill ~6 km.
 */
export function spread(center: { lat: number; lng: number }, index: number, stepDeg = 0.011): { lat: number; lng: number } {
  if (index === 0) return center;
  const angle = index * 2.399963; // golden angle in radians
  const r = stepDeg * Math.sqrt(index);
  return {
    lat: center.lat + r * Math.sin(angle),
    lng: center.lng + (r * Math.cos(angle)) / Math.cos((center.lat * Math.PI) / 180),
  };
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

  // --- dots: one per resource ---------------------------------------------
  const dots: MapDot[] = [];
  const placed = new Set<string>();
  for (const pin of pins) {
    dots.push({ ...pin, placement: "address", placeLabel: pin.address });
    placed.add(pin.id);
  }
  // Approximate dots spread within the county each program serves. A program
  // serving several counties is drawn once, in the person's county if it is
  // one of them, otherwise in the first.
  const userCounty = loc?.county?.replace(/ County$/i, "");
  const perCenter = new Map<string, number>();
  const nextIndex = (key: string) => {
    const i = (perCenter.get(key) ?? 0) + 1;
    perCenter.set(key, i);
    return i;
  };
  for (const ref of refs) {
    if (placed.has(ref.id)) continue;
    const resource = byId.get(ref.id)!;
    const names = resource.service_area.flatMap((e) => countiesForArea(e).names);
    if (names.length === 0) continue;
    const name = userCounty && names.includes(userCounty) ? userCounty : names[0];
    const center = countyCentroid(name);
    if (!center) continue;
    const { lat, lng } = spread(center, nextIndex(`county:${name}`));
    dots.push({ ...ref, lat, lng, placement: "county", placeLabel: `Serves ${name} County (approximate location)` });
    placed.add(ref.id);
  }
  // Statewide and national programs are available wherever the person is, so
  // cluster them around the person. Without a location they are listed only.
  if (user) {
    for (const ref of refs) {
      if (placed.has(ref.id)) continue;
      const { lat, lng } = spread(user, nextIndex("near_you"), 0.008);
      dots.push({ ...ref, lat, lng, placement: "near_you", placeLabel: "Available statewide or online, so shown near you" });
      placed.add(ref.id);
    }
  }

  return { dots, areas, statewide, national, unmapped, pins, user };
}
