import { describe, expect, it } from "vitest";
import type { Resource, ScoredResource } from "../types";
import { buildPlanMapData, countiesForArea } from "./planMapData";

function scored(overrides: Partial<Resource> & { id: string }): ScoredResource {
  const resource: Resource = {
    name: overrides.id,
    organization: "Org",
    category: "rental_assistance",
    description: "",
    service_area: ["Santa Clara County, CA"],
    active: true,
    eligibility: {},
    required_documents: [],
    application_url: "https://example.org",
    source_url: "https://example.org",
    ...overrides,
  };
  return { resource, score: 0, breakdown: [], needsVerification: false };
}

describe("countiesForArea", () => {
  it("maps every service-area format to county feature names", () => {
    expect(countiesForArea("Santa Clara County, CA")).toEqual({ kind: "counties", names: ["Santa Clara"] });
    expect(countiesForArea("Santa Clara and San Mateo counties, CA")).toEqual({ kind: "counties", names: ["Santa Clara", "San Mateo"] });
    expect(countiesForArea("San Jose, CA")).toEqual({ kind: "counties", names: ["Santa Clara"] });
    expect(countiesForArea("California")).toEqual({ kind: "state", names: [] });
    expect(countiesForArea("US")).toEqual({ kind: "national", names: [] });
    expect(countiesForArea("Atlantis, CA")).toEqual({ kind: "unknown", names: [] });
  });
});

describe("buildPlanMapData", () => {
  it("groups resources by county, lists statewide ones, and only pins real addresses", () => {
    const ranked = [
      scored({ id: "a", service_area: ["San Mateo County, CA"] }),
      scored({ id: "b", service_area: ["California"] }),
      scored({ id: "c", service_area: ["Santa Clara and San Mateo counties, CA"] }),
      scored({ id: "d", service_area: ["San Jose, CA"], address: "1381 S 1st St, San Jose", lat: 37.32, lng: -121.88 }),
      scored({ id: "e", service_area: ["Santa Clara County, CA"], lat: 37.35, lng: -121.95 }), // centroid only → no pin
    ];
    const related = [scored({ id: "f", category: "legal", service_area: ["US"] })];
    const data = buildPlanMapData(ranked, related, { location: { city: "Los Altos", county: "Santa Clara County", lat: 37.38, lng: -122.11 } });

    // Areas sort by how many programs serve them.
    expect(data.areas.map((a) => [a.name, a.resources.map((r) => r.id)])).toEqual([
      ["Santa Clara", ["c", "d", "e"]],
      ["San Mateo", ["a", "c"]],
    ]);
    expect(data.statewide.map((r) => r.id)).toEqual(["b"]);
    expect(data.national.map((r) => [r.id, r.section, r.rank])).toEqual([["f", "related", 6]]);
    expect(data.pins.map((p) => p.id)).toEqual(["d"]);
    expect(data.unmapped).toEqual([]);
    expect(data.user).toEqual({ lat: 37.38, lng: -122.11, label: "Los Altos" });
  });

  it("omits the user marker when the location has no coordinates", () => {
    expect(buildPlanMapData([], [], { location: { county: "Santa Clara County" } }).user).toBeUndefined();
  });
});
