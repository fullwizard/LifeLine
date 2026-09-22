/**
 * HARD GATES. A resource either survives every gate or it is excluded.
 * No partial credit here — that is scoring's job.
 *
 * A gate only fails on a *known* contradiction. Unknown facts always pass
 * (and are later reported as "unverified" by the scorer).
 */
import type {
  ExcludedResource,
  GateFailure,
  MatchContext,
  Resource,
  Situation,
} from "../types";
import { evaluateIncome } from "./income";
import { describeLocation, evaluateServiceArea } from "./location";

export function runGates(
  resource: Resource,
  situation: Situation,
  context: MatchContext = {},
): GateFailure[] {
  const failures: GateFailure[] = [];
  const e = resource.eligibility;

  if (!resource.active) {
    failures.push({ gate: "active", detail: "This listing is currently inactive." });
  }

  const area = evaluateServiceArea(resource.service_area, situation.location);
  if (area.verdict === "mismatch") {
    failures.push({
      gate: "service_area",
      detail: `Serves ${resource.service_area.join("; ")} — you are in ${describeLocation(situation.location)}.`,
    });
  }

  const income = evaluateIncome(e, situation, context.areaMedianIncomeAnnual, resource.eligibility_verified !== false);
  if (income.status === "unmet") {
    failures.push({ gate: "income_limit", detail: income.detail });
  }

  if (e.requires_eviction_notice && situation.housingStatus !== undefined) {
    const hasNotice = situation.housingStatus === "eviction_notice";
    if (!hasNotice) {
      failures.push({
        gate: "eviction_notice",
        detail: "Requires a formal eviction notice; you indicated you have not received one.",
      });
    }
  }

  if (e.requires_children && situation.hasChildren === false) {
    failures.push({ gate: "children", detail: "Only for households with minor children." });
  }

  if (e.requires_veteran && situation.isVeteran === false) {
    failures.push({ gate: "veteran", detail: "Only for veterans." });
  }

  if (e.housing_status_any_of && situation.housingStatus !== undefined) {
    if (!e.housing_status_any_of.includes(situation.housingStatus)) {
      failures.push({
        gate: "housing_status",
        detail: `Only for people who are ${e.housing_status_any_of.map(humanStatus).join(" or ")}.`,
      });
    }
  }

  return failures;
}

export function humanStatus(s: string): string {
  switch (s) {
    case "housed_stable":
      return "stably housed";
    case "housed_at_risk":
      return "at risk of losing housing";
    case "eviction_notice":
      return "facing eviction";
    case "unhoused":
      return "currently unhoused";
    default:
      return s;
  }
}

/** Split a candidate list into survivors and excluded (with reasons). */
export function applyGates(
  resources: Resource[],
  situation: Situation,
  context: MatchContext = {},
): { survivors: Resource[]; excluded: ExcludedResource[] } {
  const survivors: Resource[] = [];
  const excluded: ExcludedResource[] = [];
  for (const resource of resources) {
    const failures = runGates(resource, situation, context);
    if (failures.length === 0) survivors.push(resource);
    else excluded.push({ resource, failures });
  }
  return { survivors, excluded };
}
