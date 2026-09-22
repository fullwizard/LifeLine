import { createHash } from "node:crypto";
import { load } from "cheerio";

// These tags describe discovery coverage, not verified Resource categories or
// eligibility. A page mentioning a population does not prove it serves them.
const TOPICS = [
  ["rental_assistance", /\b(?:rent(?:al)?|housing|evictions?|tenants?|foreclosure)\b/i],
  ["shelter", /\b(?:shelters?|homeless(?:ness)?|unhoused|transitional housing|safe parking)\b/i],
  ["food", /\b(?:food|meals?|nutrition|hunger|calfresh|snap|wic)\b/i],
  ["utility", /\b(?:utilit(?:y|ies)|energy assistance|electric(?:ity)? bills?|water bills?|heating|liheap|lihwap|internet access|broadband|lifeline phone)\b/i],
  ["employment", /\b(?:employment|unemployment|job(?:s|less)?|workforce|vocational|career training|apprenticeships?|caljobs)\b/i],
  ["legal", /\b(?:legal (?:aid|help|services|assistance)|tenant rights|legal rights|legal clinics?|immigration|lawyers?|attorneys?|expungement)\b/i],
  ["public_benefits", /\b(?:public benefits|cash (?:aid|assistance)|financial (?:aid|assistance)|general (?:assistance|relief)|calworks|capi|ssi|ssdi|tax credits?|earned income|cal eitc|caleitc|benefitscal)\b/i],
  ["health_care", /\b(?:health(?:care| care| coverage| insurance| services)?|medical|dental|vision care|clinics?|prescriptions?|medi[ -]?cal|medicare|covered california|calaim)\b/i],
  ["family_support", /\b(?:child(?:ren|care| care| support)?|famil(?:y|ies)|parents?|pregnan(?:cy|t)|maternal|infants?|foster youth|youth services|domestic violence)\b/i],
  ["veteran_support", /\b(?:veterans?|military famil(?:y|ies)|calvet|service members?)\b/i],
  ["older_adult_support", /\b(?:seniors?|older adults?|elderly|aging|ageing)\b/i],
  ["disability", /\b(?:disabilit(?:y|ies)|disabled|ihss|in[ -]home supportive services|developmental services)\b/i],
  ["mobility_impairment", /\b(?:mobility|wheelchairs?|paratransit|assistive (?:devices?|technology)|accessible transportation)\b/i],
  ["mental_health_condition", /\b(?:mental health|behavioral health|behavioural health|depression|anxiety|psychiatric|schizophrenia|bipolar|ptsd|suicide prevention|crisis counseling)\b/i],
  ["substance_use_disorder", /\b(?:substance (?:use|abuse)|addiction|alcohol(?:ism| treatment)?|drug treatment|opioids?|recovery services|detox)\b/i],
  ["diabetes", /\b(?:diabet(?:es|ic)|insulin)\b/i],
  ["cancer", /\b(?:cancer|oncology|chemotherapy)\b/i],
  ["chronic_illness", /\b(?:chronic (?:illness(?:es)?|conditions?|diseases?)|long[ -]term (?:illness(?:es)?|conditions?))\b/i],
  ["heart_disease", /\b(?:heart (?:disease|failure|conditions?)|cardiac|cardiovascular)\b/i],
  ["kidney_disease", /\b(?:kidney (?:disease|failure)|renal|dialysis)\b/i],
  ["respiratory_condition", /\b(?:asthma|copd|respiratory (?:conditions?|diseases?)|lung (?:disease|conditions?))\b/i],
  ["hiv_aids", /\b(?:hiv(?:\/aids)?|acquired immunodeficiency syndrome|(?<!hearing )(?<!visual )(?<!mobility )aids (?:drug|treatment|services?|care|support|assistance|programs?|benefits)|adap|ryan white)\b/i],
];

const NAMED_PROGRAMS = /\b(?:calfresh|medi[ -]?cal|calworks|wic|liheap|lihwap|caljobs|benefitscal|covered california|calaim|ssi|ssdi|capi|ihss|in[ -]home supportive services|adap|ryan white|calvet|california children['’]s services)\b/i;
const DIRECT_SERVICES = /\b(?:rental assistance|housing assistance|eviction prevention|emergency shelter|food banks?|food pantr(?:y|ies)|food assistance|free meals?|meal delivery|utility assistance|energy assistance|job training|job search assistance|legal aid|legal assistance|financial assistance|cash assistance|disability services|mobility assistance|patient assistance|prescription assistance|health coverage|support groups?|crisis (?:line|hotline)|treatment services|child care assistance|childcare assistance|veteran services|veterans services)\b/i;
const HELP_SIGNALS = [
  ["apply_or_enroll", /\b(?:apply|applying|applications?|enroll(?:ment)?|register|sign up|eligib(?:le|ility)|qualif(?:y|ies|ications?))\b/i],
  ["services_or_support", /\b(?:assistance|support|services?|benefits|help|counseling|counselling|referrals?|case management)\b/i],
  ["access_or_affordability", /\b(?:free|low[ -]cost|no[ -]cost|affordable|reduced[ -]cost|sliding scale|subsid(?:y|ies|ized)|fee waivers?|hotlines?|helplines?|appointments?|find (?:a|an|your)|get care|get help|call (?:us|today))\b/i],
];
const PAGE_TYPES = [
  ["procurement", /\b(?:procurement|requests? for proposals?|requests? for qualifications?|rfp|rfq|bid opportunities|contract opportunities|vendor solicitations?|notice inviting bids)\b/i, /\/(?:procurement|rfp|rfq|bids|solicitations)(?:\/|$)/i],
  ["meeting_or_agenda", /\b(?:meeting (?:minutes|agendas?)|board (?:meeting|agenda)|commission (?:meeting|agenda)|agenda packet|minutes of)\b/i, /\/(?:agendas?|minutes)(?:\/|$)/i],
  ["news_or_archive", /\b(?:press releases?|news releases?|newsroom|news archive|news archives|press archive|archived news)\b/i, /\/(?:news|newsroom|press-releases?|news-releases?|archives?)(?:\/|$)/i],
  ["employer_recruitment", /\b(?:job postings?|job openings?|job vacancies|employment opportunities|career opportunities|current vacancies|join our team|work (?:with|for|at) us|we['’]re hiring)\b/i, /\/(?:careers|job-openings|job-opportunities|job-postings|employment-opportunities)(?:\/|$)/i],
  ["research_or_statistics", /\b(?:research reports?|statistical reports?|annual reports?|data dashboards?|surveillance reports?)\b/i, /\/(?:statistics|data-dashboard)(?:\/|$)/i],
];

const NON_CONTENT = [
  "script", "style", "noscript", "template", "svg", "canvas", "iframe",
  "[hidden]", '[aria-hidden="true"]', "[inert]",
  '[role="dialog"][aria-label*="cookie" i]',
  ".cookie-banner", ".cookie-consent", ".cookie-notice", ".cookies-banner",
  "#cookie-banner", "#cookie-consent", "#onetrust-banner-sdk", "#onetrust-consent-sdk",
  ".osano-cm-window", ".grecaptcha-badge", ".skip-link", ".skip-to-content",
].join(",");
const BOILERPLATE = [
  "nav", '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
  ".site-header", ".site-footer", "#site-header", "#site-footer",
  ".global-header", ".global-footer", "#footer-widgets", ".footer-widgets",
  ".breadcrumb", ".breadcrumbs", '[aria-label="breadcrumb" i]',
  ".social-share", ".share-buttons", ".language-switcher",
].join(",");
const BLOCKS = "address,article,aside,blockquote,br,dd,div,dl,dt,figcaption,figure,footer,h1,h2,h3,h4,h5,h6,header,hr,li,main,ol,p,section,table,td,th,tr,ul";
const MAX_TEXT_LENGTH = 60_000;
const MAX_LINKS = 1_000;

function cleanText(value) {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

// Cheerio decodes entities; block separators stop adjacent HTML elements from
// becoming one word ("food" + "assistance" must not become "foodassistance").
function readableText($, selection) {
  const copy = selection.clone();
  copy.find(BLOCKS).before(" ").after(" ");
  return cleanText(copy.text());
}

function httpUrl(value, base) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = new URL(value, base);
    if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

function metadata($, attribute, value) {
  const node = $("meta").filter((_, item) => ($(item).attr(attribute) || "").toLowerCase() === value).first();
  return cleanText(node.attr("content") || "");
}

function linkContext($, anchor, cache) {
  const container = anchor.closest("li,p,dd,td,article,section,div").first();
  const selected = container.length ? container : anchor.parent();
  const node = selected[0];
  if (!cache.has(node)) cache.set(node, readableText($, selected));
  const nearby = cache.get(node);
  const anchorText = cleanText(anchor.text());
  const index = nearby.indexOf(anchorText);
  const start = index > 180 ? index - 180 : 0;
  return nearby.slice(start, start + 600);
}

function containsContent($, selection) {
  const copy = selection.clone();
  copy.find(BOILERPLATE).remove();
  return cleanText(copy.text()).length > 0;
}

// Preserve links from explicitly labeled recommendations and metadata, while
// excluding their other programs' names from this page's subject/evidence.
// Only link-dominated sections qualify; substantive service descriptions stay.
function relatedNavigation($, primary) {
  const nodes = new Set();
  primary.find("h2,h3,h4,h5,h6").each((_, heading) => {
    if (!/^(?:related (?:services|programs|resources|pages|links|information|content)|you may also like|topics|keywords|tags)\s*:?$/i.test(cleanText($(heading).text()))) return;
    const level = Number(heading.name.slice(1));
    const siblings = [];
    let next = $(heading).next();
    while (next.length) {
      if (/^h[1-6]$/.test(next[0].name) && Number(next[0].name.slice(1)) <= level) break;
      siblings.push(next[0]);
      next = next.next();
    }
    const region = $(siblings);
    const total = cleanText(region.text()).length;
    const linked = region.find("a").add(region.filter("a")).toArray()
      .reduce((length, node) => length + cleanText($(node).text()).length, 0);
    if (linked > 0 && linked / Math.max(1, total) >= 0.6) {
      nodes.add(heading);
      for (const node of siblings) nodes.add(node);
    }
  });
  return nodes;
}

/**
 * Extract source evidence without running page scripts or interpreting medical
 * requirements. Links and contacts are observations, never inferred claims.
 */
export function extractPage(html, url, discoveredFrom = null) {
  const pageUrl = new URL(url).href;
  const $ = load(html);
  const title = cleanText($("title").first().text() || metadata($, "property", "og:title"));
  const description = metadata($, "name", "description") || metadata($, "property", "og:description");
  const canonicalValue = $('link[rel~="canonical"]').first().attr("href");
  const canonicalUrl = canonicalValue ? httpUrl(canonicalValue, pageUrl) : null;
  // A same-origin <base> is safe for relative links. A cross-origin base must
  // not quietly redirect discovery away from the fetched source.
  const baseValue = httpUrl($("base[href]").first().attr("href"), pageUrl);
  const baseUrl = baseValue && new URL(baseValue).origin === new URL(pageUrl).origin ? baseValue : pageUrl;

  $(NON_CONTENT).remove();
  const primarySelector = "main,[role=main]";
  const candidates = [
    $(primarySelector).filter((_, node) => $(node).parents(primarySelector).length === 0),
    $("article").filter((_, node) => $(node).parents("article").length === 0),
    $("#main-content,#maincontent,#content,.main-content,.region-content").first(),
    $("body"),
  ];
  // Some government templates leave an empty #main-content placeholder below
  // their real hero/service tiles. Existence alone must not select that shell.
  const primary = candidates.find((selection) => selection.length && containsContent($, selection)) ?? $("body");
  const relatedNodes = relatedNavigation($, primary);

  const linksByUrl = new Map();
  const phones = new Map();
  const emails = new Map();
  const contextByNode = new Map();
  let linksTruncated = false;
  // Main-content links take the budget first. Large global menus should not
  // crowd out an application link near the end of a program description.
  const anchors = new Set([...primary.find("a[href],area[href]").toArray(), ...$("a[href],area[href]").toArray()]);
  for (const node of anchors) {
    const anchor = $(node);
    const href = (anchor.attr("href") || "").trim();
    const text = cleanText(anchor.text() || anchor.attr("aria-label") || anchor.attr("title") || anchor.find("img").attr("alt") || "");
    const navigation = anchor.closest(BOILERPLATE).length > 0 ||
      !primary.toArray().some((main) => main === node || $.contains(main, node));
    if (/^tel:/i.test(href)) {
      if (!navigation) phones.set(href.slice(4), { value: href.slice(4), url: href, text });
      continue;
    }
    if (/^mailto:/i.test(href)) {
      const value = href.slice(7).split("?")[0];
      if (!navigation) emails.set(value, { value, url: href, text });
      continue;
    }
    if (!href || href.startsWith("#")) continue;
    const target = httpUrl(href, baseUrl);
    if (!target) continue;
    if (linksByUrl.size >= MAX_LINKS && !linksByUrl.has(target)) { linksTruncated = true; continue; }
    const previous = linksByUrl.get(target);
    if (!previous || (previous.navigation && !navigation) || (!previous.text && text)) {
      const related = [...relatedNodes].some((section) => section === node || $.contains(section, node));
      linksByUrl.set(target, { url: target, text, context: navigation ? "" : linkContext($, anchor, contextByNode), navigation, ...(related ? { related: true } : {}) });
    }
  }

  for (const node of relatedNodes) $(node).remove();
  $(BOILERPLATE).remove();
  // Article headers often contain the actual program name, so only remove
  // site-level headers/footers. Do not discard service sidebars wholesale.
  $("header,footer").filter((_, node) => $(node).parents("main,article,[role=main]").length === 0).remove();
  const allHeadings = primary.find("h1,h2,h3,h4").toArray().map((node) => readableText($, $(node))).filter(Boolean);
  const headings = allHeadings.slice(0, 100);
  const fullText = readableText($, primary);
  const text = fullText.slice(0, MAX_TEXT_LENGTH);
  const excerpt = text.slice(0, 1_200);
  const links = [...linksByUrl.values()];

  for (const match of text.matchAll(/(?<!\d)(?:\+?1[ .-]?)?\(?[2-9]\d{2}\)?[ .-]?\d{3}[ .-]\d{4}(?:\s*(?:ext\.?|x)\s*\d{1,6})?(?!\d)/gi)) {
    const value = match[0];
    if (![...phones.values()].some((phone) => phone.value.replace(/\D/g, "").endsWith(value.replace(/\D/g, "")))) {
      phones.set(value, { value, text: value });
    }
  }
  for (const match of text.matchAll(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi)) {
    if (!emails.has(match[0])) emails.set(match[0], { value: match[0], text: match[0] });
  }

  const relevance = scoreRelevance({ url: pageUrl, title, description, headings, text, links });
  return {
    url: pageUrl, title, description, headings, excerpt, text, links,
    contacts: { phones: [...phones.values()], emails: [...emails.values()] },
    ...(canonicalUrl ? { canonicalUrl } : {}),
    contentHash: createHash("sha256").update(`${title}\n${text}`).digest("hex"),
    truncated: { text: fullText.length > MAX_TEXT_LENGTH, excerpt: fullText.length > 1_200, headings: allHeadings.length > 100, links: linksTruncated },
    discoveredFrom, relevance,
  };
}

/**
 * A topic plus practical assistance is required. Frequency never increases the
 * score, which prevents repeated menus/keywords from overpowering the filter.
 */
export function scoreRelevance({ url = "", title = "", description = "", headings = [], text = "", excerpt = "", links = [] }) {
  const fields = [
    { text: title, weight: 4 },
    { text: headings.join("\n"), weight: 3 },
    { text: description, weight: 2 },
    { text: text || excerpt, weight: 1 },
  ];
  const topics = [];
  const matchedTerms = new Set();
  let score = 0;
  for (const [topic, pattern] of TOPICS) {
    const found = fields.find((field) => pattern.test(field.text));
    if (!found) continue;
    topics.push(topic);
    matchedTerms.add(found.text.match(pattern)[0].toLowerCase());
    score += found.weight;
  }
  // Generic site descriptions are weak metadata: they can increase a score,
  // but must not make an unrelated page relevant on their own.
  const searchable = `${title}\n${headings.join("\n")}\n${text || excerpt}`;
  const helpSignals = HELP_SIGNALS.filter(([, pattern]) => pattern.test(searchable));
  for (const [, pattern] of helpSignals) matchedTerms.add(searchable.match(pattern)[0].toLowerCase());
  score += helpSignals.length * 2;
  const namedProgram = searchable.match(NAMED_PROGRAMS);
  const directService = searchable.match(DIRECT_SERVICES);
  if (namedProgram) { matchedTerms.add(namedProgram[0].toLowerCase()); score += 5; }
  if (directService) { matchedTerms.add(directService[0].toLowerCase()); score += 4; }

  let path = "";
  try { path = decodeURIComponent(new URL(url).pathname); } catch { /* Optional URL metadata. */ }
  const identity = `${title}\n${headings[0] || ""}`;
  const negativeTerms = PAGE_TYPES.filter(([, pattern, pathPattern]) => pattern.test(identity) || pathPattern.test(path)).map(([type]) => type);
  const actionableLinks = links.some((link) => !link.navigation && /\b(?:apply|enroll|sign up|get help|find (?:a|an)|request (?:help|assistance)|(?:program|service) application)\b/i.test(link.text));
  const seekerPage = /\b(?:job seekers?|job training|job search|find a job|career training|career counseling|employment assistance|unemployment benefits|career centers?|employment centers?)\b/i.test(`${identity}\n${description}\n${text}`);
  const excludedType = negativeTerms.find((type) => {
    if (type === "employer_recruitment") return !seekerPage;
    if (type === "news_or_archive" || type === "research_or_statistics") return !actionableLinks;
    return true;
  });
  score -= negativeTerms.length * 4;
  const mainTopic = TOPICS.some(([, pattern]) => pattern.test(searchable));
  const enoughEvidence = mainTopic && (helpSignals.length > 0 || Boolean(namedProgram) || Boolean(directService));
  const relevant = !excludedType && enoughEvidence;
  let reason = "Matches assistance topics and practical help or a named program.";
  if (excludedType) reason = `Skipped ${excludedType.replaceAll("_", " ")} page; follow its program links instead.`;
  else if (!mainTopic) reason = "No supported assistance topic was found in the main page content.";
  else if (!enoughEvidence) reason = "A topic is mentioned, but no practical help or named assistance program was found.";

  return { score, relevant, topics, matchedTerms: [...matchedTerms], negativeTerms, reason };
}
