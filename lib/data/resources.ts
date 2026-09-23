/**
 * Resource access layer. Reads data/resources.json, which is produced by
 * `npm run promote:resources` from the crawl output plus human-reviewed
 * overrides. The crawl output itself is never imported by the app.
 *
 * Swap the body of getResources() for a Supabase query later; nothing else
 * needs to change.
 */
import type { Resource, ResourceCategory } from "../types";
import { RESOURCE_CATEGORIES } from "../types";
import promoted from "../../data/resources.json";
import { PLACES } from "./places";

type PromotedRecord = (typeof promoted.resources)[number];

/** Coordinates for the most specific place named in the service area. */
function coordinatesForServiceArea(serviceArea: string[]): { lat: number; lng: number } | undefined {
  for (const entry of serviceArea) {
    const placeName = entry.split(",")[0].trim().toLowerCase();
    const city = PLACES.find((place) => place.city.toLowerCase() === placeName);
    if (city) return { lat: city.lat, lng: city.lng };
    const county = PLACES.find((place) => placeName.includes(place.county.toLowerCase().replace(/ county$/, "")));
    if (county) return { lat: county.lat, lng: county.lng };
  }
  return undefined;
}

function toResource(record: PromotedRecord): Resource {
  if (!RESOURCE_CATEGORIES.includes(record.category as ResourceCategory)) {
    throw new Error(`data/resources.json: "${record.id}" has unknown category "${record.category}". Re-run npm run promote:resources.`);
  }
  return {
    id: record.id,
    name: record.name,
    organization: record.organization,
    category: record.category as ResourceCategory,
    description: record.description,
    service_area: record.service_area,
    active: record.active,
    eligibility: record.eligibility as Resource["eligibility"],
    eligibility_verified: record.eligibility_verified,
    required_documents: record.required_documents,
    application_url: record.application_url,
    source_url: record.source_url,
    ...("phone" in record && record.phone ? { phone: record.phone } : {}),
    ...("response_time_days" in record && typeof record.response_time_days === "number" ? { response_time_days: record.response_time_days } : {}),
    ...(coordinatesForServiceArea(record.service_area) ?? {}),
    last_verified: record.last_verified,
  };
}

if (!Array.isArray(promoted.resources) || promoted.resources.length === 0) {
  throw new Error("data/resources.json has no resources. Run npm run promote:resources.");
}

const RESOURCES: Resource[] = promoted.resources.map(toResource);

export async function getResources(): Promise<Resource[]> {
  return RESOURCES;
}
