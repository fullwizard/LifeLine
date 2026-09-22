/** Resource access layer backed by the reviewed California crawl output. */
import type { Resource, ResourceCategory } from "../types";
import candidates from "../../data/crawl-output/california-resource-candidates.json";
import { PLACES } from "./places";

type CandidateRecord = (typeof candidates.candidates)[number];

function coordinatesForServiceArea(serviceArea: string[]): { lat: number; lng: number } | undefined {
  for (const entry of serviceArea) {
    const placeName = entry.split(",")[0].trim().toLowerCase();
    const city = PLACES.find((place) => place.city.toLowerCase() === placeName);
    if (city) return { lat: city.lat, lng: city.lng };
    const county = PLACES.find((place) => {
      const countyName = place.county.toLowerCase().replace(/ county$/, "");
      return placeName.includes(countyName);
    });
    if (county) return { lat: county.lat, lng: county.lng };
  }
  return undefined;
}

function toResource(candidate: CandidateRecord): Resource | undefined {
  if (!candidate.category) return undefined;
  const coordinates = coordinatesForServiceArea(candidate.service_area);
  return {
    id: candidate.id,
    name: candidate.name,
    organization: candidate.organization,
    category: candidate.category as ResourceCategory,
    description: candidate.description,
    service_area: candidate.service_area,
    active: candidate.active,
    eligibility: candidate.eligibility,
    ...(candidate.eligibility_verified !== undefined ? { eligibility_verified: candidate.eligibility_verified } : {}),
    required_documents: candidate.required_documents,
    application_url: candidate.application_url,
    source_url: candidate.source_url,
    ...(candidate.phone ? { phone: candidate.phone } : {}),
    ...(coordinates ?? {}),
    last_verified: candidate.last_verified,
  };
}

const CALIFORNIA_RESOURCES: Resource[] = candidates.candidates
  .map(toResource)
  .filter((resource): resource is Resource => resource !== undefined);

export async function getResources(): Promise<Resource[]> {
  return CALIFORNIA_RESOURCES;
}
