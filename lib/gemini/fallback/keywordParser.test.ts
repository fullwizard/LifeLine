import { describe, expect, it } from "vitest";
import { parseSituationByKeywords as parse } from "./keywordParser";

describe("keyword parser: housing status", () => {
  it("detects a formal notice in its many phrasings", () => {
    for (const text of [
      "I got an eviction notice.",
      "got a 3 day notice from my landlord",
      "landlord gave me a 3-day pay or quit",
      "60-day notice to vacate",
      "landlord filed an unlawful detainer, court date is next tuesday",
      "we got served papers by the sheriff",
    ]) {
      expect(parse(text).housingStatus, text).toBe("eviction_notice");
    }
  });

  it("treats a denied or hedged notice as at-risk, not a notice", () => {
    for (const text of [
      "behind on rent, no eviction notice yet",
      "havent gotten an eviction notice but im 2 months behind",
      "I might get evicted soon, i'm worried",
      "landlord is trying to evict me for no reason",
      "food and diapers for my newborn, no eviction notice",
    ]) {
      expect(parse(text).housingStatus, text).toBe("housed_at_risk");
    }
  });

  it("detects at-risk from rent trouble", () => {
    for (const text of [
      "Can't pay my rent this month",
      "we're behind two months on rent",
      "I owe $4,000 in back rent",
      "rent due next week and my husband lost his job",
      "Landlord says we have to be out by the 1st",
      "hours got cut, can't cover rent this month",
    ]) {
      expect(parse(text).housingStatus, text).toBe("housed_at_risk");
    }
  });

  it("detects unhoused including doubled-up and motel situations", () => {
    for (const text of [
      "sleeping in my car",
      "Im a vet living in my truck",
      "Staying at my sister's place for now, can't stay much longer",
      "Lost my apartment last month, been in a motel",
      "my mom and I got kicked out, staying at a friends",
      "nowhere to go tonight",
      "homeless in the bay area",
    ]) {
      expect(parse(text).housingStatus, text).toBe("unhoused");
    }
  });

  it("does not invent a housing status from unrelated money trouble", () => {
    expect(parse("Can't afford groceries this week.").housingStatus).toBeUndefined();
    expect(parse("my PG&E bill is $400 and I can't pay it").housingStatus).toBeUndefined();
  });
});

describe("keyword parser: income", () => {
  it("does not mistake rent or bills for income", () => {
    expect(parse("Rent is $3,200 a month and I only make $2,800 a month.").monthlyIncome).toBe(2800);
    expect(parse("my rent is 2000 a month and i bring home like 1900").monthlyIncome).toBe(1900);
    expect(parse("my PG&E bill is $400 and I can't pay it. On social security $1,400/month").monthlyIncome).toBe(1400);
    expect(parse("I owe $4,000 in back rent").monthlyIncome).toBeUndefined();
  });

  it("converts weekly, yearly, hourly, and word amounts to monthly", () => {
    expect(parse("I make about $600 a week").monthlyIncome).toBe(2600);
    expect(parse("I make $85,000 a year").monthlyIncome).toBe(7083);
    expect(parse("made 30k a year before I got laid off").monthlyIncome).toBe(2500);
    expect(parse("Two thousand a month from disability").monthlyIncome).toBe(2000);
    expect(parse("we make about 5k/month combined").monthlyIncome).toBe(5000);
  });

  it("uses stated hours per week for hourly wages", () => {
    expect(parse("I make $22 an hour but my hours dropped to 20/week").monthlyIncome).toBe(1907);
    expect(parse("Can't pay my rent, hours cut to 15/week at $19/hr").monthlyIncome).toBe(1235);
    expect(parse("I make $20 an hour").monthlyIncome).toBe(3467); // assumes 40h
  });

  it("adds a partner's stated income and records no income as zero", () => {
    expect(parse("i make 4k a month she makes 1500").monthlyIncome).toBe(5500);
    expect(parse("no income right now").monthlyIncome).toBe(0);
    expect(parse("staying with my aunt, no money").monthlyIncome).toBe(0);
  });
});

describe("keyword parser: household", () => {
  it("reads explicit sizes", () => {
    expect(parse("Family of 4 in Santa Clara").householdSize).toBe(4);
    expect(parse("we're a family of five").householdSize).toBe(5);
    expect(parse("3 people in my household").householdSize).toBe(3);
    expect(parse("Household of 2.").householdSize).toBe(2);
    expect(parse("2 adults and 3 kids").householdSize).toBe(5);
  });

  it("adds up stated partners, kids, and relatives", () => {
    expect(parse("I live with my wife and 2 kids").householdSize).toBe(4);
    expect(parse("single mom, one daughter").householdSize).toBe(2);
    expect(parse("with my partner and our baby").householdSize).toBe(3);
    expect(parse("my mom and I got kicked out").householdSize).toBe(2);
    expect(parse("living with my parents, no kids").householdSize).toBe(3);
    expect(parse("Live alone").householdSize).toBe(1);
    expect(parse("Just me.").householdSize).toBe(1);
  });

  it("leaves size unknown when the count is not stated", () => {
    expect(parse("need food for my kids").householdSize).toBeUndefined();
    expect(parse("single dad, laid off").householdSize).toBeUndefined();
  });

  it("detects children and their absence", () => {
    expect(parse("single mom, one daughter").hasChildren).toBe(true);
    expect(parse("sleeping in the car with my 5 year old").hasChildren).toBe(true);
    expect(parse("I don't have kids").hasChildren).toBe(false);
    expect(parse("no kids, not a veteran").hasChildren).toBe(false);
    expect(parse("my kids are grown").hasChildren).toBe(false);
    expect(parse("I need help with food.").hasChildren).toBeUndefined();
  });
});

describe("keyword parser: veteran", () => {
  it("recognises veterans without false positives", () => {
    expect(parse("Im a vet living in my truck").isVeteran).toBe(true);
    expect(parse("im a veteran with ptsd").isVeteran).toBe(true);
    expect(parse("I served in the Navy for six years").isVeteran).toBe(true);
    expect(parse("I work at the Salvation Army thrift store").isVeteran).toBeUndefined();
    expect(parse("took my dog to the vet").isVeteran).toBeUndefined();
    expect(parse("not a veteran").isVeteran).toBe(false);
    expect(parse("never served").isVeteran).toBe(false);
  });
});

describe("keyword parser: needs", () => {
  it("only lists needs the person actually raised", () => {
    const s = parse("Family of 4 in Santa Clara, behind on rent, no eviction notice yet. Income around $3,800 a month.");
    expect(s.needs).toEqual(["rental_assistance"]);
  });

  it("does not add a need that was negated", () => {
    const s = parse("homeless in the bay area, no kids, not a veteran, need a place to sleep tonight");
    expect(s.needs).toEqual(["shelter"]);
  });

  it("keeps a need expressed as 'can't afford'", () => {
    expect(parse("Can't afford groceries this week.").needs).toEqual(["food"]);
    expect(parse("I don't have insurance. Need a dentist.").needs).toEqual(["health"]);
  });

  it("recognises utilities, employment, legal, and health phrasings", () => {
    expect(parse("my PG&E bill is $400").needs).toContain("utility");
    expect(parse("our lights got shut off").needs).toContain("utility");
    expect(parse("hours got cut").needs).toContain("employment");
    expect(parse("laid off in august, need work").needs).toContain("employment");
    expect(parse("landlord is trying to evict me, need legal help").needs).toContain("legal");
    expect(parse("My health insurance lapsed and I need a doctor").needs).toContain("health");
    expect(parse("Income around $3,800 a month").needs ?? []).not.toContain("employment");
  });

  it("implies needs from status and identity", () => {
    expect(parse("I got an eviction notice.").needs).toEqual(expect.arrayContaining(["rental_assistance", "legal"]));
    expect(parse("sleeping in my car").needs).toContain("shelter");
    expect(parse("im a veteran, behind on rent").needs).toContain("veteran_support");
    expect(parse("I'm 68, my bill is late").needs).toContain("older_adult_support");
    expect(parse("I'm on dialysis").needs).toContain("condition_support");
    expect(parse("I have depression").needs).toContain("mental_health");
  });

  it("extracts explicitly stated health conditions without treating a denial as a condition", () => {
    const s = parse("I have diabetes and PTSD, use a wheelchair, and do not have asthma.");
    expect(s.conditions).toEqual(["mobility_impairment", "mental_health_condition", "diabetes"]);
  });
});

describe("keyword parser: end to end", () => {
  it("handles a full description", () => {
    const s = parse(
      "I live in San Jose with my two kids. Got a pay or vacate notice yesterday, I make about $2,400 a month and I'm behind on rent. Also our power might get shut off.",
    );
    expect(s.location?.county).toBe("Santa Clara County");
    expect(s.housingStatus).toBe("eviction_notice");
    expect(s.hasChildren).toBe(true);
    expect(s.householdSize).toBe(3);
    expect(s.monthlyIncome).toBe(2400);
    expect(s.needs).toEqual(expect.arrayContaining(["rental_assistance", "utility", "legal"]));
  });

  it("handles slang and abbreviations", () => {
    const s = parse("yo i need help w rent, im in sj, landlord gave me a 3-day pay or quit. me + my gf + our 2 boys. i make 4k a month she makes 1500");
    expect(s.location?.city).toBe("San Jose");
    expect(s.housingStatus).toBe("eviction_notice");
    expect(s.householdSize).toBe(4);
    expect(s.monthlyIncome).toBe(5500);
  });

  it("leaves unknown fields undefined rather than guessing", () => {
    const s = parse("I need help with food.");
    expect(s.location).toBeUndefined();
    expect(s.housingStatus).toBeUndefined();
    expect(s.hasChildren).toBeUndefined();
    expect(s.isVeteran).toBeUndefined();
    expect(s.monthlyIncome).toBeUndefined();
    expect(s.householdSize).toBeUndefined();
    expect(s.needs).toEqual(["food"]);
  });
});

describe("keyword parser: cases from the crawl review", () => {
  it("recognises local abbreviations and indirect employment and family needs", () => {
    const s = parse(
      "I live in EPA. I'm a plumber and after a mass firing spree I got laid off. My wife is pregnant. I want to ensure a better future for my family.",
    );
    expect(s.location?.city).toBe("East Palo Alto");
    expect(s.needs).toEqual(expect.arrayContaining(["employment", "family_support"]));
  });

  it("recognises direct substance-use language", () => {
    const s = parse("I'm addicted to meth and need help finding treatment.");
    expect(s.needs).toContain("substance_use");
    expect(s.conditions).toContain("substance_use_disorder");
  });

  it("prioritizes self-harm and relapse over secondary financial needs", () => {
    const s = parse("feeling of self harm, recently off the wagon, finances starting to slip, my family won't help");
    expect(s.needs?.slice(0, 2)).toEqual(["mental_health", "substance_use"]);
    expect(s.needs).toContain("benefits");
    expect(s.conditions).toEqual(expect.arrayContaining(["mental_health_condition", "substance_use_disorder"]));
  });
});
