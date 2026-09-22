/** Resource access layer backed by the reviewed California crawl output. */
import type { Resource, ResourceCategory } from "../types";
import candidates from "../../data/crawl-output/california-resource-candidates.json";

type CandidateRecord = (typeof candidates.candidates)[number];

function toResource(candidate: CandidateRecord): Resource | undefined {
  if (!candidate.category) return undefined;
  return {
    id: candidate.id,
    name: candidate.name,
    organization: candidate.organization,
    category: candidate.category as ResourceCategory,
    description: candidate.description,
    service_area: candidate.service_area,
    active: candidate.active,
    eligibility: candidate.eligibility,
    required_documents: candidate.required_documents,
    application_url: candidate.application_url,
    source_url: candidate.source_url,
    ...(candidate.phone ? { phone: candidate.phone } : {}),
    last_verified: candidate.last_verified,
  };
}

const CALIFORNIA_RESOURCES: Resource[] = candidates.candidates
  .map(toResource)
  .filter((resource): resource is Resource => resource !== undefined);

export async function getResources(): Promise<Resource[]> {
  return CALIFORNIA_RESOURCES;
}
