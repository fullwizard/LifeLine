import { describe, expect, it } from "vitest";
import { resolvePlace } from "./places";

describe("resolvePlace", () => {
  it("resolves cities across the Bay Area", () => {
    expect(resolvePlace("I live in Los Altos")?.county).toBe("Santa Clara County");
    expect(resolvePlace("Cupertino")?.city).toBe("Cupertino");
    expect(resolvePlace("Fremont")?.county).toBe("Alameda County");
    expect(resolvePlace("I got an eviction notice. San Francisco.")?.county).toBe("San Francisco County");
    expect(resolvePlace("Campbell CA")?.city).toBe("Campbell");
  });

  it("prefers the longer place name", () => {
    expect(resolvePlace("Los Altos Hills")?.city).toBe("Los Altos Hills");
    expect(resolvePlace("South San Francisco")?.city).toBe("South San Francisco");
    expect(resolvePlace("East Palo Alto")?.city).toBe("East Palo Alto");
  });

  it("resolves a county name to the county, not a same-named city", () => {
    const loc = resolvePlace("we live in santa clara county");
    expect(loc).toEqual({ county: "Santa Clara County" });
    expect(resolvePlace("Santa Clara")?.city).toBe("Santa Clara");
  });

  it("resolves ZIP codes and ignores money that looks like one", () => {
    expect(resolvePlace("I'm in SJ 95126")?.zip).toBe("95126");
    expect(resolvePlace("94041")?.city).toBe("Mountain View");
    expect(resolvePlace("94303")?.city).toBe("East Palo Alto");
    expect(resolvePlace("I make $95,000 a year")).toBeUndefined();
  });

  it("accepts nicknames in a place-like slot", () => {
    expect(resolvePlace("im in sj")?.city).toBe("San Jose");
    expect(resolvePlace("SF")?.city).toBe("San Francisco");
    expect(resolvePlace("staying with my aunt in EPA")?.city).toBe("East Palo Alto");
    expect(resolvePlace("the epa fined them")).toBeUndefined();
  });

  it("returns undefined for unknown places", () => {
    expect(resolvePlace("Atlantis")).toBeUndefined();
    expect(resolvePlace("homeless in the bay area")).toBeUndefined();
  });
});
