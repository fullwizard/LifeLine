/**
 * 100% Area Median Income (Median Family Income), annual USD, 4-person
 * household, HUD FY2026 (effective May 1, 2026). Refresh each spring when HUD
 * publishes new limits: https://www.huduser.gov/portal/datasets/il.html
 *
 * Keys are "<county>, <state>" lowercased. Counties in the same HUD Metro FMR
 * Area share one figure.
 *
 * NOTE: for high-housing-cost areas HUD publishes 50% and 80% limits that are
 * higher than a straight percentage of the Median Family Income. Where that
 * applies we store the *effective* figure that reproduces HUD's published
 * 4-person limits, so `limit = ami × pct` matches what programs actually use.
 */
import type { Location } from "../types";

interface AmiEntry {
  amiAnnual4Person: number;
  hmfa: string;
  fiscalYear: number;
  source: string;
}

const AMI_BY_COUNTY: Record<string, AmiEntry> = {
  // San Jose-Sunnyvale-Santa Clara HMFA
  "santa clara county, ca": {
    amiAnnual4Person: 205_500,
    hmfa: "San Jose-Sunnyvale-Santa Clara, CA HUD Metro FMR Area",
    fiscalYear: 2026,
    source: "https://www.huduser.gov/portal/datasets/il.html",
  },
  // San Francisco HMFA (Marin, San Francisco, San Mateo). MFI is $200,800 but
  // HUD's published 4-person limits are $105,050 (50%) and $168,100 (80%),
  // which correspond to an effective figure of $210,100.
  "san mateo county, ca": {
    amiAnnual4Person: 210_100,
    hmfa: "San Francisco, CA HUD Metro FMR Area",
    fiscalYear: 2026,
    source: "https://www.huduser.gov/portal/datasets/il.html",
  },
  "san francisco county, ca": {
    amiAnnual4Person: 210_100,
    hmfa: "San Francisco, CA HUD Metro FMR Area",
    fiscalYear: 2026,
    source: "https://www.huduser.gov/portal/datasets/il.html",
  },
  "marin county, ca": {
    amiAnnual4Person: 210_100,
    hmfa: "San Francisco, CA HUD Metro FMR Area",
    fiscalYear: 2026,
    source: "https://www.huduser.gov/portal/datasets/il.html",
  },
  // Oakland-Fremont HMFA (Alameda, Contra Costa)
  "alameda county, ca": {
    amiAnnual4Person: 162_800,
    hmfa: "Oakland-Fremont, CA HUD Metro FMR Area",
    fiscalYear: 2026,
    source: "https://www.huduser.gov/portal/datasets/il.html",
  },
  "contra costa county, ca": {
    amiAnnual4Person: 162_800,
    hmfa: "Oakland-Fremont, CA HUD Metro FMR Area",
    fiscalYear: 2026,
    source: "https://www.huduser.gov/portal/datasets/il.html",
  },
  // Santa Cruz-Watsonville MSA. MFI is $137,200 but HUD's published 4-person
  // limits are $108,750 (50%) and $174,550 (80%): effective figure $217,500.
  "santa cruz county, ca": {
    amiAnnual4Person: 217_500,
    hmfa: "Santa Cruz-Watsonville, CA MSA",
    fiscalYear: 2026,
    source: "https://www.huduser.gov/portal/datasets/il.html",
  },
};

/** Every location in the gazetteer is in California; state defaults to CA. */
export function lookupAreaMedianIncome(loc: Location | undefined): number | undefined {
  return lookupAmiEntry(loc)?.amiAnnual4Person;
}

export function lookupAmiEntry(loc: Location | undefined): AmiEntry | undefined {
  if (!loc?.county) return undefined;
  const county = loc.county.trim().toLowerCase();
  const key = `${county.endsWith(" county") ? county : `${county} county`}, ca`;
  return AMI_BY_COUNTY[key];
}
