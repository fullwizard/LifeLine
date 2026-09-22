import { load } from "cheerio";
import { extractPage } from "./content.mjs";
import { programPageKey } from "./identity.mjs";
import { createHttpClient } from "./http.mjs";
import { createPageCache } from "./cache.mjs";
import { crawlTrap, documentKind, inSourceScope, linkPriority, normalizeUrl, usefulLead } from "./urls.mjs";

export const DEFAULTS = {
  concurrency: 4,
  maxTotalPages: 300,
  maxDepth: 4,
  maxQueue: 1500,
  maxSitemaps: 2,
  delayMs: 1000,
  timeoutMs: 15000,
  maxRetries: 2,
  maxRequests: 1200,
};

/** Bounded discovery and evidence collection; does not publish Resource records. */
export async function crawlSources(sources, options = {}, dependencies = {}) {
  const settings = { ...DEFAULTS, ...options };
  const client = dependencies.client ?? createHttpClient(settings);
  const cache = dependencies.cache ?? createPageCache(settings.cacheDir);
  const progress = dependencies.onProgress ?? (() => {});
  const ordered = [...sources].sort((a, b) => a.crawlOrder - b.crawlOrder || b.priority - a.priority);
  const states = ordered.map((source) => ({
    source,
    result: {
      id: source.id, name: source.name, priority: source.priority, crawlOrder: source.crawlOrder,
      sourceType: source.kind ?? "official", evidenceUrls: source.evidenceUrls ?? [],
      serviceArea: source.serviceArea, startUrl: source.startUrl,
      attemptedPages: 0, inspectedPages: 0, pages: [], skippedIrrelevant: [], duplicates: [],
      discoveries: [], errors: [], sitemapRequests: 0, queuedNotVisited: 0,
    },
    maxPages: settings.maxPages ?? source.maxPages ?? 20,
    discoveryKeys: new Set(),
    sitemapOrigins: new Set(),
  }));
  const statesByOrigin = new Map();
  for (const state of states) {
    for (const origin of state.source.allowedOrigins) {
      if (!statesByOrigin.has(origin)) statesByOrigin.set(origin, []);
      statesByOrigin.get(origin).push(state);
    }
  }
  const frontier = new Map();
  const seen = new Set();
  const processedUrls = new Set();
  const contentHashes = new Map();
  const programPages = new Map();
  const sitemapCache = new Map();
  let attemptedPages = 0;
  let cacheRevalidations = 0;
  let sequence = 0;
  let queueLimitReached = false;
  let requestLimitReached = false;
  const startedAt = new Date().toISOString();

  function owner(url, preferred) {
    if (preferred && inSourceScope(url, preferred.source)) return preferred;
    return statesByOrigin.get(new URL(url).origin)?.find((state) => inSourceScope(url, state.source));
  }

  function retainDiscovery(state, link, discoveredFrom, reason) {
    const url = normalizeUrl(link.url);
    if (!url) return;
    const key = `${url}|${discoveredFrom}`;
    if (state.discoveryKeys.has(key)) return;
    // Bound output size on unusually large directories, and expose truncation.
    if (state.result.discoveries.length >= settings.maxQueue) {
      state.result.discoveriesTruncated = true;
      return;
    }
    state.discoveryKeys.add(key);
    state.result.discoveries.push({
      url, text: link.text ?? "", context: link.context ?? "", discoveredFrom,
      kind: documentKind(url), reason, reviewStatus: "needs_review",
    });
  }

  function enqueue(state, link, discoveredFrom, depth, seed = false) {
    const url = normalizeUrl(link.url);
    if (!url || crawlTrap(url) || documentKind(url) === "asset") return;
    const target = owner(url, state);
    if (documentKind(url) === "document" || !target) {
      // Keep provider/application/document leads found in content, not social/nav links.
      if (usefulLead({ ...link, url })) {
        retainDiscovery(state, { ...link, url }, discoveredFrom, documentKind(url) === "document" ? "document_needs_extraction" : "outside_configured_sources");
      }
      return;
    }
    if (depth > settings.maxDepth) {
      if (!link.navigation) retainDiscovery(state, { ...link, url }, discoveredFrom, "depth_limit");
      return;
    }
    if (seen.has(url)) return;
    const score = (seed ? 100000 : 0) + target.source.priority + linkPriority({ ...link, url }) * 3 - depth * 4;
    const existing = frontier.get(url);
    if (existing) {
      if (score > existing.score) Object.assign(existing, { score, state: target, depth, discoveredFrom });
      return;
    }
    if (frontier.size >= settings.maxQueue) {
      queueLimitReached = true;
      // Useful program links displace the weakest pending navigation links.
      let lowest;
      for (const candidate of frontier.values()) {
        if (!lowest || candidate.score < lowest.score || (candidate.score === lowest.score && candidate.sequence > lowest.sequence)) lowest = candidate;
      }
      if (lowest.score >= score) return;
      frontier.delete(lowest.url);
    }
    frontier.set(url, { url, origin: new URL(url).origin, state: target, score, depth, discoveredFrom, sequence: sequence++ });
  }

  async function sitemapUrls(origin) {
    if (!sitemapCache.has(origin)) {
      sitemapCache.set(origin, (async () => {
        const rules = await client.robots(origin);
        if (rules.error) {
          if (rules.error.code === "REQUEST_LIMIT") requestLimitReached = true;
          return { urls: [], errors: [], requests: 0 };
        }
        const pending = (rules.sitemaps?.length ? rules.sitemaps : [`${origin}/sitemap.xml`])
          .map((url) => normalizeUrl(url, origin)).filter((url) => url && new URL(url).origin === origin);
        const visited = new Set();
        const urls = [];
        const errors = [];
        let requests = 0;
        while (pending.length && requests < settings.maxSitemaps && !requestLimitReached) {
          const url = pending.shift();
          if (visited.has(url)) continue;
          visited.add(url);
          requests += 1;
          try {
            const response = await client.get(url, { allowUrl: (target) => target.origin === origin });
            if (response.status === 404 || response.status === 410) continue;
            if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
            const $ = load(response.text, { xmlMode: true });
            const root = $.root().children().first()[0]?.name?.split(":").pop();
            if (!["urlset", "sitemapindex"].includes(root)) continue;
            const locations = $("*").filter((_, element) => element.name?.split(":").pop() === "loc")
              .map((_, element) => normalizeUrl($(element).text().trim(), url)).get().filter(Boolean);
            if (root === "sitemapindex") {
              pending.push(...locations.filter((href) => new URL(href).origin === origin && !/\.gz$/i.test(new URL(href).pathname)).slice(0, 100));
            } else {
              urls.push(...locations.slice(0, settings.maxQueue * 2).map((href) => ({ url: href, discoveredFrom: response.url })));
            }
          } catch (error) {
            if (error.code === "REQUEST_LIMIT") requestLimitReached = true;
            errors.push({ url, stage: "sitemap", code: error.code ?? "SITEMAP", message: error.message });
          }
        }
        return { urls: [...new Map(urls.map((entry) => [entry.url, entry])).values()], errors, requests };
      })());
    }
    return sitemapCache.get(origin);
  }

  async function discoverSitemaps(job) {
    if (!settings.maxSitemaps || job.state.sitemapOrigins.has(new URL(job.url).origin)) return;
    const origin = new URL(job.url).origin;
    job.state.sitemapOrigins.add(origin);
    const shared = sitemapCache.has(origin);
    const map = await sitemapUrls(origin);
    if (!shared) job.state.result.sitemapRequests += map.requests;
    job.state.result.errors.push(...map.errors);
    for (const { url, discoveredFrom } of map.urls) {
      // Sitemaps can span a whole government. Only enqueue scoped assistance leads.
      if (inSourceScope(url, job.state.source) && linkPriority({ url }) >= 10) {
        enqueue(job.state, { url, text: "", navigation: false }, discoveredFrom, 1);
      }
    }
  }

  async function visit(job) {
    const { state, url } = job;
    const result = state.result;
    seen.add(url);
    attemptedPages += 1;
    result.attemptedPages += 1;
    progress({ type: "visit", url, source: result.id, attemptedPages });
    try {
      const stored = await cache.read(url);
      const cached = stored && inSourceScope(stored.url, state.source) ? stored : null;
      const headers = {};
      if (cached?.etag) headers["if-none-match"] = cached.etag;
      if (cached?.lastModified) headers["if-modified-since"] = cached.lastModified;
      let response = await client.get(url, { headers, allowUrl: (target) => inSourceScope(target, state.source) });
      let revalidated = false;
      if (response.status === 304) {
        if (cached && normalizeUrl(response.url) === normalizeUrl(cached.url)) {
          response = { ...response, status: 200, text: cached.text, contentType: cached.contentType };
          revalidated = true;
          cacheRevalidations += 1;
        } else {
          response = await client.get(url, { allowUrl: (target) => inSourceScope(target, state.source) });
        }
      }
      if (response.status !== 200) {
        result.errors.push({ url, code: "HTTP", status: response.status, message: `HTTP ${response.status}` });
        return;
      }
      if (!/text\/html|application\/xhtml\+xml/i.test(response.contentType)) {
        retainDiscovery(state, { url: response.url, text: "" }, job.discoveredFrom, "unsupported_content_type");
        return;
      }
      if (isChallengePage(response.text)) {
        result.errors.push({ url, code: "ACCESS_CHALLENGE", message: "The server returned a bot challenge instead of assistance content." });
        return;
      }
      const finalUrl = normalizeUrl(response.url);
      if (processedUrls.has(finalUrl)) {
        result.duplicates.push({ url, duplicateOf: finalUrl, reason: "redirect" });
        return;
      }
      seen.add(finalUrl);
      processedUrls.add(finalUrl);
      frontier.delete(finalUrl);
      if (!revalidated) {
        try { await cache.write(url, response); }
        catch (error) { result.errors.push({ url, stage: "cache", code: "CACHE_WRITE", message: error.message }); }
      }
      result.inspectedPages += 1;
      const page = extractPage(response.text, finalUrl, job.discoveredFrom);
      if (page.text.length < 200 && /(?:enable|requires?|turn on)\s+(?:your\s+)?(?:java\s*script|javascript)|you need to enable javascript/i.test(response.text)) {
        retainDiscovery(state, { url: finalUrl, text: page.title }, job.discoveredFrom, "javascript_required");
        result.errors.push({ url, code: "JAVASCRIPT_REQUIRED", message: "This page requires JavaScript to expose its content." });
        return;
      }
      page.checkedAt = new Date().toISOString();
      page.fetchStatus = revalidated ? "not_modified" : "downloaded";
      page.reviewStatus = "needs_review";
      const duplicateOf = page.text.length > 80 ? contentHashes.get(page.contentHash) : null;
      const programKey = programPageKey(page);
      const sameProgramPage = programKey ? programPages.get(programKey) : null;
      if (duplicateOf) {
        result.duplicates.push({ url: page.url, duplicateOf, reason: "same_content" });
      } else if (sameProgramPage) {
        result.duplicates.push({ url: page.url, duplicateOf: sameProgramPage, reason: "same_program_name_and_description" });
      } else if (page.relevance.relevant) {
        result.pages.push(page);
        if (page.text.length > 80) contentHashes.set(page.contentHash, page.url);
        if (programKey) programPages.set(programKey, page.url);
      } else {
        result.skippedIrrelevant.push({ url: page.url, title: page.title, relevance: page.relevance, discoveredFrom: page.discoveredFrom });
      }
      // Irrelevant hubs may still link to useful programs: explore them within bounds.
      for (const link of page.links) enqueue(state, link, page.url, job.depth + 1);
    } catch (error) {
      if (error.code === "REQUEST_LIMIT" || error.cause?.code === "REQUEST_LIMIT") requestLimitReached = true;
      const redirectedTo = error.code === "SCOPE" && error.url !== url ? normalizeUrl(error.url) : null;
      if (redirectedTo) {
        const link = { url: redirectedTo, text: "Application or provider redirect" };
        if (owner(redirectedTo)) enqueue(state, link, url, job.depth + 1);
        else retainDiscovery(state, link, url, "redirect_outside_configured_source");
      }
      const transportCode = error.transportCode ?? error.cause?.transportCode;
      result.errors.push({ url, code: error.code ?? "FETCH", message: error.message, ...(transportCode ? { transportCode } : {}), ...(error.status ? { status: error.status } : {}), ...(redirectedTo ? { redirectedTo } : {}), ...(error.retryAt ? { retryAt: error.retryAt } : {}) });
    } finally {
      // Sitemaps are discovery supplements; skip them once this source's page budget is spent.
      if (!requestLimitReached && result.attemptedPages < state.maxPages && attemptedPages < settings.maxTotalPages) {
        await discoverSitemaps(job).catch((error) => result.errors.push({ url, stage: "sitemap", code: "SITEMAP", message: error.message }));
      }
    }
  }

  for (const state of states) {
    const seeds = new Set([state.source.startUrl, ...(state.source.startUrls ?? [])]);
    for (const url of seeds) {
      if (!inSourceScope(url, state.source)) throw new Error(`Seed outside source scope: ${state.source.id}: ${url}`);
      enqueue(state, { url, text: state.source.name }, null, 0, true);
    }
  }
  // Honor CA.gov as the initial crawl origin before parallelizing other sources.
  const firstUrl = ordered[0] && normalizeUrl(ordered[0].startUrl);
  if (firstUrl && settings.maxTotalPages > 0) {
    const first = { url: firstUrl, origin: new URL(firstUrl).origin, state: states[0], score: Infinity, depth: 0, discoveredFrom: null, sequence: -1 };
    frontier.delete(firstUrl);
    await visit(first);
  }

  const active = new Map();
  while (frontier.size || active.size) {
    while (!requestLimitReached && active.size < settings.concurrency && attemptedPages < settings.maxTotalPages) {
      const available = [...frontier.values()].filter((job) => job.state.result.attemptedPages < job.state.maxPages);
      if (!available.length) break;
      const origins = new Set([...active.values()].map((job) => job.origin));
      available.sort((a, b) => Number(origins.has(a.origin)) - Number(origins.has(b.origin))
        || b.score - a.score || a.sequence - b.sequence);
      const job = available[0];
      frontier.delete(job.url);
      const promise = visit(job).finally(() => active.delete(promise));
      active.set(promise, job);
    }
    if (!active.size) break;
    await Promise.race(active.keys());
    if (dependencies.checkpoint) await dependencies.checkpoint(snapshot());
  }
  return snapshot();

  function snapshot() {
    for (const state of states) {
      const pending = [...frontier.values()].filter((job) => job.state === state);
      state.result.queuedNotVisited = pending.length;
      state.result.pendingUrls = pending.sort((a, b) => b.score - a.score || a.sequence - b.sequence)
        .map(({ url, discoveredFrom, depth }) => ({ url, discoveredFrom, depth }));
      state.result.pages.sort((a, b) => a.url.localeCompare(b.url));
    }
    const results = states.map((state) => state.result);
    const topics = {};
    for (const page of results.flatMap((result) => result.pages)) {
      for (const topic of page.relevance.topics) topics[topic] = (topics[topic] ?? 0) + 1;
    }
    return {
      schemaVersion: 2, startedAt, generatedAt: new Date().toISOString(),
      settings: { concurrency: settings.concurrency, maxPagesPerSource: settings.maxPages ?? "source_default", maxTotalPages: settings.maxTotalPages,
        maxDepth: settings.maxDepth, maxQueue: settings.maxQueue, maxSitemaps: settings.maxSitemaps, maxRequests: settings.maxRequests,
        maxRetries: settings.maxRetries, delayMs: settings.delayMs, timeoutMs: settings.timeoutMs },
      summary: {
        attemptedPages, inspectedPages: results.reduce((sum, result) => sum + result.inspectedPages, 0),
        keptPages: results.reduce((sum, result) => sum + result.pages.length, 0),
        skippedIrrelevant: results.reduce((sum, result) => sum + result.skippedIrrelevant.length, 0),
        duplicates: results.reduce((sum, result) => sum + result.duplicates.length, 0),
        discoveries: results.reduce((sum, result) => sum + result.discoveries.length, 0),
        errors: results.reduce((sum, result) => sum + result.errors.length, 0),
        pendingPages: frontier.size, queueLimitReached, requestLimitReached, cacheRevalidations, topics, network: { ...client.stats },
      },
      sources: results,
    };
  }
}

export function isChallengePage(html) {
  return /(?:request unsuccessful\.\s*incapsula incident id|<title>\s*(?:just a moment|attention required|access denied|verify you are human)|id=["']challenge-form["'])/i.test(html)
    || (html.length < 15000 && /(?:_Incapsula_Resource|cf-chl-|captcha-delivery\.com)/i.test(html));
}
