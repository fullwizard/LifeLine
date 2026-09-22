import { describe, expect, it } from "vitest";
import { extractPage } from "./content.mjs";

const URL = "https://www.example.ca.gov/services/page";
function page(title, body, url = URL) {
  return extractPage(`<html><head><title>${title}</title></head><body><main><h1>${title}</h1>${body}</main></body></html>`, url);
}

describe("assistance relevance", () => {
  it.each([
    ["rental_assistance", "Rental assistance", "Apply for help with overdue rent."],
    ["shelter", "Safe parking", "Get help and access a safe overnight space."],
    ["food", "CalFresh", "Benefits can pay for groceries."],
    ["utility", "Utility bills", "Apply for financial assistance."],
    ["employment", "Job training", "Register for free career training."],
    ["legal", "Legal aid", "Free advice for tenants."],
    ["public_benefits", "CalWORKs", "Application forms and eligibility."],
    ["health_care", "Medi-Cal", "Enroll in health coverage."],
    ["family_support", "Child care", "Low-cost services for working parents."],
    ["veteran_support", "Veteran services", "Apply for benefits and support."],
    ["disability", "Disability support", "Call to request an assessment."],
    ["mobility_impairment", "Paratransit", "Eligible residents can apply for services."],
    ["mental_health_condition", "Mental health", "Free counseling and referrals."],
    ["substance_use_disorder", "Substance use treatment", "Call for a free appointment."],
    ["diabetes", "Diabetes", "Apply for insulin assistance."],
    ["cancer", "Cancer", "Patient assistance with transportation costs."],
    ["chronic_illness", "Chronic illness", "Find support groups near you."],
    ["heart_disease", "Heart disease", "Financial assistance for patients."],
    ["kidney_disease", "Kidney disease", "Apply for help with dialysis transportation."],
    ["respiratory_condition", "Asthma", "Free home services and clinic appointments."],
    ["hiv_aids", "HIV/AIDS", "Enroll in the medication assistance program."],
  ])("retains useful %s opportunities", (topic, title, body) => {
    const result = page(title, `<p>${body}</p>`);
    expect(result.relevance.relevant).toBe(true);
    expect(result.relevance.topics).toContain(topic);
  });

  it("does not match rent inside parent or contact alone as assistance", () => {
    const result = page("Parent directory", "<p>Contact the parent company for a corporate prospectus.</p>");
    expect(result.relevance.topics).not.toContain("rental_assistance");
    expect(result.relevance.relevant).toBe(false);
  });

  it("requires practical help rather than generic disease facts", () => {
    const result = page("Diabetes overview", "<p>Diabetes affects blood glucose. Symptoms vary. Treatment depends on severity.</p>");
    expect(result.relevance.topics).toContain("diabetes");
    expect(result.relevance.relevant).toBe(false);
  });

  it("does not mislabel hearing aids as HIV/AIDS", () => {
    const result = page("Hearing aids", "<p>Financial assistance for hearing aids is available.</p>");
    expect(result.relevance.topics).not.toContain("hiv_aids");
    expect(result.relevance.relevant).toBe(true);
  });

  it("recognizes AIDS assistance without labeling hearing aid programs as HIV support", () => {
    expect(page("AIDS assistance", "<p>Apply for medication support.</p>").relevance.topics).toContain("hiv_aids");
    expect(page("Hearing aids programs", "<p>Apply for financial assistance.</p>").relevance.topics).not.toContain("hiv_aids");
  });

  it("ignores repeated navigation, cookie banners, and generic metadata", () => {
    const result = extractPage(`<title>Museum opening times</title>
      <meta name="description" content="County housing assistance, food assistance and health services">
      <header><nav><a href="/help">CalFresh and housing assistance</a></nav></header>
      <div class="cookie-banner">Apply for Medi-Cal and job training ${"food assistance ".repeat(30)}</div>
      <main><h1>Museum opening times</h1><p>Open on Saturday. Historic county photos on display.</p></main>
      <footer>Apply for CalWORKs</footer>`, URL);
    expect(result.relevance.relevant).toBe(false);
    expect(result.text).not.toContain("CalFresh");
    expect(result.text).not.toContain("Medi-Cal");
    expect(result.text).not.toContain("CalWORKs");
    expect(result.links).toContainEqual(expect.objectContaining({ url: "https://www.example.ca.gov/help", navigation: true }));
  });

  it("finds services beyond the first excerpt", () => {
    const result = page("Community center", `<p>${"History and local information. ".repeat(150)}</p><p>Apply for free food assistance.</p>`);
    expect(result.excerpt).not.toContain("food assistance");
    expect(result.text).toContain("food assistance");
    expect(result.relevance.relevant).toBe(true);
  });

  it.each([
    ["Housing procurement", "/procurement/rental-program", "Procurement: request for proposals for rental assistance services."],
    ["Housing Commission Agenda", "/agendas/2026", "Meeting agenda. Discuss food assistance and housing services."],
    ["News archive", "/news", "CalFresh news and housing assistance announcements."],
    ["Job posting: Health worker", "/careers/health-worker", "Apply for this employment opportunity with medical benefits."],
    ["Annual report on homelessness", "/reports/annual", "Annual report on shelter services and financial assistance spending."],
  ])("skips %s while retaining outgoing program links", (title, path, body) => {
    const result = page(title, `<p>${body}</p><a href="/program">Program information</a>`, `https://www.example.ca.gov${path}`);
    expect(result.relevance.relevant).toBe(false);
    expect(result.relevance.negativeTerms.length).toBeGreaterThan(0);
    expect(result.links[0].url).toBe("https://www.example.ca.gov/program");
  });

  it("preserves job-seeker services even under an employment opportunities path", () => {
    const result = page("Job seekers: Employment opportunities", "<p>Free job search assistance and job training. Register today.</p>", "https://www.example.ca.gov/employment-opportunities");
    expect(result.relevance.relevant).toBe(true);
  });

  it("retains actionable news that links directly to assistance", () => {
    const result = page("Press release: New rental assistance", '<p>Rental assistance is open for applications.</p><a href="/apply">Apply for rent help</a>', "https://www.example.ca.gov/news/rent-relief");
    expect(result.relevance.relevant).toBe(true);
    expect(result.relevance.negativeTerms).toContain("news_or_archive");
  });
});

describe("page evidence extraction", () => {
  it("decodes entities and preserves useful links, context, and contacts", () => {
    const result = extractPage(`<title>Food &amp; health</title><meta content="Children&#39;s care &amp; support" name="description">
      <link rel="canonical" href="https://elsewhere.example/canonical">
      <main><header><h1>Children&#8217;s services</h1></header>
      <p>Apply for food assistance &amp; health coverage.</p>
      <section><h2>Application forms</h2><p>Download the <a href="../forms/apply.pdf?x=1&amp;y=2">paper application</a> for CalFresh.</p></section>
      <p><a href="https://provider.example/apply">Get help from our provider</a></p>
      <p><a href="tel:+16505551212">Call 650-555-1212</a> or <a href="mailto:help@example.gov?subject=Help">email us</a>.</p>
      <p>Alternate telephone: (408) 555-2323.</p>
      </main>`, URL, "https://www.example.ca.gov/services");
    expect(result.title).toBe("Food & health");
    expect(result.description).toBe("Children's care & support");
    expect(result.headings).toContain("Children’s services");
    expect(result.links).toContainEqual(expect.objectContaining({ url: "https://www.example.ca.gov/forms/apply.pdf?x=1&y=2", text: "paper application", context: expect.stringContaining("CalFresh") }));
    expect(result.links).toContainEqual(expect.objectContaining({ url: "https://provider.example/apply" }));
    expect(result.contacts.phones).toContainEqual(expect.objectContaining({ value: "+16505551212" }));
    expect(result.contacts.phones).toContainEqual(expect.objectContaining({ value: "(408) 555-2323" }));
    expect(result.contacts.emails).toEqual([expect.objectContaining({ value: "help@example.gov" })]);
    expect(result.canonicalUrl).toBe("https://elsewhere.example/canonical");
    expect(result.url).toBe(URL);
    expect(result.discoveredFrom).toBe("https://www.example.ca.gov/services");
  });

  it("keeps fallback body content and inserts block word separators", () => {
    const result = extractPage('<title>Help</title><nav>Unrelated menu</nav><div><h2>Food</h2><p>assistance</p></div>', URL);
    expect(result.text).toBe("Food assistance");
    expect(result.relevance.relevant).toBe(true);
  });

  it("preserves content in multiple articles", () => {
    const result = extractPage('<title>Community services</title><article><h2>First article</h2><p>Office information</p></article><article><h2>Food assistance</h2><p>Apply today.</p></article>', URL);
    expect(result.text).toContain("Food assistance");
    expect(result.relevance.relevant).toBe(true);
  });

  it("falls back from an empty template main to real service content", () => {
    const result = extractPage(`<title>Individuals and families</title><header role="banner">Department menu</header>
      <section id="hero"><h1>Disability services</h1><p>Support for individuals with developmental disabilities.</p></section>
      <div class="hero-group"><a href="/eligibility">Regional center eligibility and services</a><a href="/employment">Employment support</a></div>
      <div id="main-content"><div class="container"> </div></div><div id="footer-widgets">Unrelated footer contact</div>`, URL);
    expect(result.text).toContain("developmental disabilities");
    expect(result.text).not.toContain("Unrelated footer");
    expect(result.relevance.topics).toContain("disability");
    expect(result.links).toContainEqual(expect.objectContaining({ url: "https://www.example.ca.gov/eligibility", navigation: false }));
  });

  it("keeps short linked service directories as the main region", () => {
    const result = extractPage('<title>Assistance</title><main><a href="/food">Food assistance</a></main><aside>Unrelated museum employment benefits</aside>', URL);
    expect(result.text).toBe("Food assistance");
    expect(result.relevance.topics).toEqual(["food"]);
    expect(result.links[0].navigation).toBe(false);
  });

  it("retains related program links without attributing their subjects to this page", () => {
    const result = page("Food stamps", `<p>Apply for CalFresh food benefits.</p><h2>Required documents</h2><p>Proof of income and household expenses.</p>
      <h3>Related services</h3><p><a href="/housing">Rental assistance</a><a href="/legal">Legal aid</a></p>
      <h3>Topics</h3><p><a href="/disability">Disability</a></p>
      <h2>How to apply</h2><p>Call for help with your application.</p>`);
    expect(result.text).toContain("Proof of income");
    expect(result.text).toContain("Call for help");
    expect(result.relevance.topics).not.toContain("rental_assistance");
    expect(result.relevance.topics).not.toContain("legal");
    expect(result.relevance.topics).not.toContain("disability");
    expect(result.links).toContainEqual(expect.objectContaining({ url: "https://www.example.ca.gov/housing", related: true, navigation: false }));
  });

  it("retains substantive service sections even with a related-services heading", () => {
    const result = page("Family support", `<h2>Related services</h2><p>Our program provides free legal assistance for families facing eviction. We can help you prepare paperwork, understand your rights, and request a hearing. Call us for an appointment.</p><a href="/apply">Apply</a>`);
    expect(result.text).toContain("prepare paperwork");
    expect(result.relevance.topics).toContain("legal");
  });

  it("resolves relative links and ignores unsafe links and cross-origin base tags", () => {
    const result = extractPage('<base href="https://other.example/"><main><a href="apply">Apply for food assistance</a><a href="javascript:alert(1)">Bad</a><a href="#section">Jump</a><a href="https://user:secret@example.gov/private">Bad credentials</a></main>', URL);
    expect(result.links).toHaveLength(1);
    expect(result.links[0].url).toBe("https://www.example.ca.gov/services/apply");
  });

  it("uses stable substantive hashes despite changing navigation", () => {
    const first = extractPage('<title>Food assistance</title><nav>Menu A</nav><main>Apply for free meals.</main>', URL);
    const second = extractPage('<title>Food assistance</title><nav>Menu B</nav><main>Apply for free meals.</main>', URL);
    expect(first.contentHash).toBe(second.contentHash);
    expect(first.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("bounds retained text without dropping application links late in the DOM", () => {
    const result = page("Food assistance", `<p>${"Text ".repeat(14_000)}</p><a href="/apply">Apply for meals</a>`);
    expect(result.text).toHaveLength(60_000);
    expect(result.excerpt).toHaveLength(1_200);
    expect(result.links).toContainEqual(expect.objectContaining({ url: "https://www.example.ca.gov/apply" }));
    expect(result.truncated).toEqual({ text: true, excerpt: true, headings: false, links: false });
  });

  it("prioritizes real service links over a large navigation menu", () => {
    const menu = Array.from({ length: 1_050 }, (_, index) => `<a href="/menu/${index}">Menu ${index}</a>`).join("");
    const result = extractPage(`<nav>${menu}</nav><main><h1>Food assistance</h1><p><a href="/apply">Apply for meals</a></p></main>`, URL);
    expect(result.links).toHaveLength(1_000);
    expect(result.links[0]).toEqual(expect.objectContaining({ url: "https://www.example.ca.gov/apply", navigation: false }));
    expect(result.truncated.links).toBe(true);
  });
});
