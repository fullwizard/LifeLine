const USER_AGENT = "LifeLineResourceCrawler/0.2 (+https://github.com/fullwizard/LifeLine)";
const TRANSIENT_STATUSES = new Set([429, 502, 503, 504]);
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const TRANSIENT_NETWORK_CODES = new Set([
  "EAI_AGAIN", "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ENETUNREACH", "EHOSTUNREACH", "EPIPE",
  "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT", "UND_ERR_SOCKET",
]);
const MAX_INLINE_WAIT_MS = 30_000;
const sleepDefault = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function crawlError(code, message, details = {}) {
  return Object.assign(new Error(message), { code, ...details });
}

function parseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw crawlError("SCOPE", "Invalid crawl URL.", { url: String(value) });
  }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password) {
    throw crawlError("SCOPE", "Crawl URLs must use HTTP(S) without credentials.", { url: url.href });
  }
  url.hash = "";
  return url;
}

// Compare equivalent percent-encoded unreserved characters, while preserving
// reserved characters such as an encoded slash as distinct path octets.
function normalizedPath(value, isPattern = false) {
  return value
    .replace(/%([\da-f]{2})/gi, (_, hex) => {
      const character = String.fromCharCode(Number.parseInt(hex, 16));
      return /^[a-z\d._~-]$/i.test(character) ? character : `%${hex.toUpperCase()}`;
    })
    .replace(/[^\x21-\x7e]/gu, (character) => encodeURIComponent(character))
    .replace(/\*/g, isPattern ? "*" : "%2A")
    .replace(/\$/g, "%24");
}

function compileRule(value, allow) {
  const anchored = value.endsWith("$");
  const pattern = normalizedPath(anchored ? value.slice(0, -1) : value, true);
  const pieces = pattern.split("*");
  const specificity = pattern.replace(/\*/g, "").replace(/%[\da-f]{2}/gi, "x").length;
  return {
    allow,
    specificity,
    matches(path) {
      if (!path.startsWith(pieces[0])) return false;
      if (pieces.length === 1) return !anchored || path.length === pieces[0].length;
      let cursor = pieces[0].length;
      for (let index = 1; index < pieces.length; index += 1) {
        const piece = pieces[index];
        if (anchored && index === pieces.length - 1) {
          return path.endsWith(piece) && path.length - piece.length >= cursor;
        }
        const position = path.indexOf(piece, cursor);
        if (position === -1) return false;
        cursor = position + piece.length;
      }
      return true;
    },
  };
}

/** RFC 9309 group selection and path matching, plus Crawl-delay and Sitemap. */
export function parseRobots(text, agent = "LifeLineResourceCrawler") {
  const groups = [];
  const sitemaps = new Set();
  let group = null;
  for (const rawLine of text.replace(/^\uFEFF/, "").split(/\r\n|\n|\r/)) {
    const line = rawLine.split("#", 1)[0].trim();
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (field === "sitemap") {
      if (value) sitemaps.add(value);
      continue;
    }
    if (field === "user-agent") {
      if (!group || group.hasRules) {
        group = { agents: [], rules: [], crawlDelayMs: 0, hasRules: false };
        groups.push(group);
      }
      if (value) group.agents.push(value.toLowerCase());
      continue;
    }
    if (!group) continue;
    if (field === "allow" || field === "disallow") {
      group.hasRules = true;
      if (value && /^[/*]/.test(value)) group.rules.push(compileRule(value, field === "allow"));
    } else if (field === "crawl-delay") {
      group.hasRules = true;
      if (/^\d+(?:\.\d+)?$/.test(value) && Number.isFinite(Number(value))) {
        group.crawlDelayMs = Math.max(group.crawlDelayMs, Number(value) * 1_000);
      }
    }
  }
  const specific = groups.filter((entry) => entry.agents.includes(agent.toLowerCase()));
  const matching = specific.length ? specific : groups.filter((entry) => entry.agents.includes("*"));
  const rules = matching.flatMap((entry) => entry.rules);
  return {
    crawlDelayMs: Math.max(0, ...matching.map((entry) => entry.crawlDelayMs)),
    sitemaps: [...sitemaps],
    allowed(value) {
      const url = new URL(value, "https://robots.invalid");
      if (url.pathname === "/robots.txt") return true;
      const path = normalizedPath(url.pathname + url.search);
      let winner;
      for (const rule of rules) {
        if (!rule.matches(path)) continue;
        if (!winner || rule.specificity > winner.specificity ||
            (rule.specificity === winner.specificity && rule.allow)) winner = rule;
      }
      return winner ? winner.allow : true;
    },
  };
}

function retryDelay(value, now) {
  if (!value) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric >= 0) return numeric * 1_000;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : null;
}

function isTextualContentType(contentType) {
  return !contentType || contentType.startsWith("text/") || /\/(?:[^/]+\+)?(?:xml|json)$/.test(contentType);
}

function isTransient(error) {
  if (error.code === "TIMEOUT") return true;
  const transportCode = error.cause?.code ?? error.code;
  // Fetch wraps both temporary socket failures and permanent TLS/DNS failures
  // in TypeError. A structured transport cause takes priority over that wrapper.
  if (transportCode) return TRANSIENT_NETWORK_CODES.has(transportCode);
  return error instanceof TypeError;
}

/** A single run shares origin throttles, robots results, and request budgets. */
export function createHttpClient({
  fetchImpl = fetch,
  delayMs = 1_000,
  timeoutMs = 15_000,
  maxBytes = 2 * 1024 * 1024,
  maxRetries = 2,
  maxRequests = 1_200,
  sleep = sleepDefault,
  now = Date.now,
  onEvent,
} = {}) {
  for (const [name, value] of Object.entries({ delayMs, timeoutMs, maxBytes, maxRetries, maxRequests })) {
    if (!Number.isFinite(value) || value < 0 ||
        (["maxBytes", "maxRetries", "maxRequests"].includes(name) && !Number.isInteger(value)) ||
        (["timeoutMs", "maxBytes", "maxRequests"].includes(name) && value === 0)) {
      throw new TypeError(`Invalid ${name}: ${value}`);
    }
  }
  const origins = new Map();
  const robotsByOrigin = new Map();
  const stats = { requests: 0, retries: 0, bytes: 0, robotsDenied: 0, timeouts: 0, tooLarge: 0 };

  function originState(origin) {
    if (!origins.has(origin)) origins.set(origin, { tail: Promise.resolve(), nextAt: 0, crawlDelayMs: 0 });
    return origins.get(origin);
  }

  function emit(event) {
    if (onEvent) onEvent(event);
  }

  function later(url, state, status) {
    return crawlError("RETRY_LATER", "Origin requested a delay; skipped for this run.", {
      url: url.href,
      status,
      retryAt: new Date(state.nextAt).toISOString(),
    });
  }

  async function withOrigin(url, operation) {
    const state = originState(url.origin);
    const previous = state.tail;
    let release;
    state.tail = new Promise((resolve) => { release = resolve; });
    await previous;
    let started = false;
    try {
      const waitMs = Math.max(0, state.nextAt - now());
      if (waitMs > MAX_INLINE_WAIT_MS) throw later(url, state);
      if (waitMs) await sleep(waitMs);
      if (stats.requests >= maxRequests) {
        throw crawlError("REQUEST_LIMIT", "Run request budget reached.", { url: url.href });
      }
      stats.requests += 1;
      started = true;
      return await operation(state);
    } finally {
      if (started) state.nextAt = Math.max(state.nextAt, now() + Math.max(delayMs, state.crawlDelayMs));
      release();
    }
  }

  async function fetchOnce(url, headers, byteLimit, retry) {
    return withOrigin(url, async (state) => {
      if (retry) stats.retries += 1;
      emit({ type: "request", url: url.href, retry });
      const controller = new AbortController();
      let reader;
      let response;
      let timer;
      const timedOut = crawlError("TIMEOUT", `Request exceeded ${timeoutMs} ms.`, { url: url.href });
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
          stats.timeouts += 1;
          controller.abort(timedOut);
          if (reader) void reader.cancel().catch(() => {});
          reject(timedOut);
        }, timeoutMs);
      });
      try {
        return await Promise.race([
          timeout,
          (async () => {
            response = await fetchImpl(url.href, {
              method: "GET",
              redirect: "manual",
              signal: controller.signal,
              headers: {
                accept: "text/html,application/xhtml+xml,text/plain,application/xml,text/xml;q=0.9",
                ...headers,
                "user-agent": USER_AGENT,
              },
            });
            if (controller.signal.aborted) {
              void response.body?.cancel().catch(() => {});
              throw timedOut;
            }
            timedOut.status = response.status;
            const responseHeaders = Object.fromEntries(response.headers.entries());
            const result = {
              url: url.href,
              status: response.status,
              headers: responseHeaders,
              contentType: (responseHeaders["content-type"] ?? "").split(";", 1)[0].trim().toLowerCase(),
              text: "",
            };
            if (TRANSIENT_STATUSES.has(response.status)) {
              const waitMs = retryDelay(responseHeaders["retry-after"], now());
              if (waitMs !== null) state.nextAt = Math.max(state.nextAt, now() + waitMs);
            }
            // Redirects and error responses cannot contribute useful page content.
            if (REDIRECT_STATUSES.has(response.status) || response.status >= 400) {
              void response.body?.cancel().catch(() => {});
              return result;
            }
            // Download endpoints often omit a filename extension. Preserve their
            // metadata as a discovery lead without buffering a PDF or other binary.
            if (!isTextualContentType(result.contentType)) {
              void response.body?.cancel().catch(() => {});
              return result;
            }
            if (Number(responseHeaders["content-length"]) > byteLimit) {
              throw crawlError("SIZE_LIMIT", `Response exceeds ${byteLimit} bytes.`, { url: url.href, status: response.status });
            }
            if (!response.body) return result;
            reader = response.body.getReader();
            const decoder = new TextDecoder();
            let received = 0;
            const chunks = [];
            while (true) {
              const { done, value } = await reader.read();
              if (controller.signal.aborted) throw timedOut;
              if (done) break;
              received += value.byteLength;
              stats.bytes += value.byteLength;
              if (received > byteLimit) {
                throw crawlError("SIZE_LIMIT", `Response exceeds ${byteLimit} bytes.`, { url: url.href, status: response.status });
              }
              chunks.push(decoder.decode(value, { stream: true }));
            }
            chunks.push(decoder.decode());
            result.text = chunks.join("");
            return result;
          })(),
        ]);
      } catch (error) {
        controller.abort();
        if (reader) void reader.cancel().catch(() => {});
        else if (response?.body) void response.body.cancel().catch(() => {});
        if (error.code === "SIZE_LIMIT") stats.tooLarge += 1;
        throw error;
      } finally {
        clearTimeout(timer);
      }
    });
  }

  async function request(url, headers, byteLimit) {
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      let result;
      try {
        result = await fetchOnce(url, headers, byteLimit, attempt > 0);
      } catch (error) {
        if (!isTransient(error)) {
          if (error instanceof TypeError && error.cause?.code) {
            throw crawlError("NETWORK", `${error.message} (${error.cause.code}).`, {
              url: url.href, transportCode: error.cause.code, cause: error,
            });
          }
          throw error;
        }
        if (attempt === maxRetries) {
          if (error.code === "TIMEOUT") throw error;
          throw crawlError("NETWORK", error.message, { url: url.href, cause: error });
        }
      }
      if (result && !TRANSIENT_STATUSES.has(result.status)) return result;
      const state = originState(url.origin);
      if (state.nextAt - now() > MAX_INLINE_WAIT_MS) throw later(url, state, result?.status);
      if (attempt === maxRetries) return result;
      state.nextAt = Math.max(state.nextAt, now() + 1_000 * 2 ** attempt);
      emit({ type: "retry", url: url.href, status: result?.status, attempt: attempt + 1 });
    }
  }

  async function robots(value) {
    const origin = parseUrl(value).origin;
    if (!robotsByOrigin.has(origin)) {
      robotsByOrigin.set(origin, (async () => {
        try {
          const response = await get(new URL("/robots.txt", origin), {
            allowUrl: (url) => url.origin === origin,
            checkRobots: false,
            maxBytes: Math.max(maxBytes, 512 * 1024),
          });
          if (response.status === 404 || response.status === 410) return parseRobots("");
          if (response.status < 200 || response.status >= 300) {
            throw crawlError("ROBOTS_UNAVAILABLE", `robots.txt returned HTTP ${response.status}.`, {
              status: response.status, url: response.url,
            });
          }
          if (response.contentType.includes("html") || /^\s*(?:<!doctype\s+html|<html\b)/i.test(response.text)) {
            throw crawlError("ROBOTS_UNAVAILABLE", "robots.txt returned an HTML page.", { url: response.url });
          }
          if (!isTextualContentType(response.contentType)) {
            throw crawlError("ROBOTS_UNAVAILABLE", "robots.txt returned an unsupported content type.", { url: response.url });
          }
          const parsed = parseRobots(response.text);
          const state = originState(origin);
          state.crawlDelayMs = parsed.crawlDelayMs;
          state.nextAt = Math.max(state.nextAt, now() + parsed.crawlDelayMs);
          return parsed;
        } catch (error) {
          emit({ type: "robots-error", origin, code: error.code, message: error.message });
          return { allowed: () => false, crawlDelayMs: 0, sitemaps: [], error };
        }
      })());
    }
    return robotsByOrigin.get(origin);
  }

  async function get(value, { allowUrl = () => true, headers = {}, checkRobots = true, maxBytes: byteLimit = maxBytes } = {}) {
    let url = parseUrl(value);
    if (!Number.isFinite(byteLimit) || byteLimit <= 0) throw new TypeError("maxBytes must be positive.");
    const seen = new Set();
    for (let redirects = 0; redirects <= 5; redirects += 1) {
      if (!allowUrl(url)) throw crawlError("SCOPE", "URL is outside the configured crawl scope.", { url: url.href });
      if (seen.has(url.href)) throw crawlError("REDIRECT_LIMIT", "Redirect loop detected.", { url: url.href });
      seen.add(url.href);
      if (checkRobots) {
        const policy = await robots(url.origin);
        if (policy.error) {
          if (policy.error.code === "REQUEST_LIMIT") throw policy.error;
          throw crawlError("ROBOTS_UNAVAILABLE", `Could not safely read robots.txt: ${policy.error.message}`, {
            url: url.href, status: policy.error.status, retryAt: policy.error.retryAt, cause: policy.error,
          });
        }
        if (!policy.allowed(url)) {
          stats.robotsDenied += 1;
          throw crawlError("ROBOTS_DENIED", "robots.txt disallows this path.", { url: url.href });
        }
      }
      const result = await request(url, headers, byteLimit);
      if (!REDIRECT_STATUSES.has(result.status)) return result;
      if (!result.headers.location) throw crawlError("REDIRECT_LIMIT", "Redirect has no Location header.", { url: url.href, status: result.status });
      if (redirects === 5) throw crawlError("REDIRECT_LIMIT", "Too many redirects.", { url: url.href, status: result.status });
      try {
        url = parseUrl(new URL(result.headers.location, url));
      } catch {
        throw crawlError("SCOPE", "Redirect target is not a valid public HTTP(S) URL.", { url: result.url, status: result.status });
      }
    }
  }

  return { get, robots, stats };
}
