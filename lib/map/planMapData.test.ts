import { describe, expect, it } from "vitest";
import type { Resource, ScoredResource } from "../types";
import { buildPlanMapData, countiesForArea, countyCentroid, spread } from "./planMapData";

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

  it("gives every resource a dot, spread so none overlap, and labels how it was placed", () => {
    const ranked = [
      scored({ id: "sm1", service_area: ["San Mateo County, CA"] }),
      scored({ id: "sm2", service_area: ["San Mateo County, CA"] }),
      scored({ id: "sm3", service_area: ["San Mateo County, CA"] }),
      scored({ id: "sc", service_area: ["Santa Clara County, CA"], address: "1 Main St", lat: 37.33, lng: -121.89 }),
      scored({ id: "both", service_area: ["Santa Clara and San Mateo counties, CA"] }),
      scored({ id: "ca", service_area: ["California"] }),
    ];
    const data = buildPlanMapData(ranked, [], { location: { city: "Redwood City", county: "San Mateo County", lat: 37.48, lng: -122.24 } });
    expect(data.dots.map((d) => [d.id, d.placement])).toEqual([
      ["sc", "address"],
      ["sm1", "county"],
      ["sm2", "county"],
      ["sm3", "county"],
      ["both", "county"], // drawn in the person's county
      ["ca", "near_you"],
    ]);
    const keys = new Set(data.dots.map((d) => `${d.lat.toFixed(4)},${d.lng.toFixed(4)}`));
    expect(keys.size).toBe(data.dots.length);
    const sm = countyCentroid("San Mateo")!;
    for (const d of data.dots.filter((x) => x.placement === "county")) {
      expect(Math.abs(d.lat - sm.lat)).toBeLessThan(0.1);
      expect(Math.abs(d.lng - sm.lng)).toBeLessThan(0.1);
    }
    const near = data.dots.find((d) => d.id === "ca")!;
    expect(Math.abs(near.lat - 37.48)).toBeLessThan(0.02);
  });

  it("does not draw statewide programs when the person has no coordinates", () => {
    const data = buildPlanMapData([scored({ id: "ca", service_area: ["California"] })], [], { location: { county: "Santa Clara County" } });
    expect(data.dots).toEqual([]);
    expect(data.statewide.map((r) => r.id)).toEqual(["ca"]);
  });

  it("county centroids land inside the Bay Area", () => {
    for (const name of ["Santa Clara", "San Mateo", "San Francisco", "Alameda"]) {
      const c = countyCentroid(name)!;
      expect(c.lat).toBeGreaterThan(36.9);
      expect(c.lat).toBeLessThan(38.2);
      expect(c.lng).toBeGreaterThan(-122.7);
      expect(c.lng).toBeLessThan(-121.2);
    }
  });

  it("spread is deterministic and grows with index", () => {
    const c = { lat: 37.5, lng: -122.2 };
    expect(spread(c, 0)).toEqual(c);
    expect(spread(c, 3)).toEqual(spread(c, 3));
    const d1 = spread(c, 1);
    const d9 = spread(c, 9);
    expect(Math.hypot(d9.lat - c.lat, d9.lng - c.lng)).toBeGreaterThan(Math.hypot(d1.lat - c.lat, d1.lng - c.lng));
  });

  it("omits the user marker when the location has no coordinates", () => {
    expect(buildPlanMapData([], [], { location: { county: "Santa Clara County" } }).user).toBeUndefined();
  });
});
