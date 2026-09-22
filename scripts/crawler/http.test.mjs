import { describe, expect, it, vi } from "vitest";
import { createHttpClient, parseRobots } from "./http.mjs";

const ORIGIN = "https://services.ca.gov";
const response = (text = "", status = 200, headers = {}) => new Response(text, {
  status,
  headers: { "content-type": "text/plain", ...headers },
});

function fixture(handler, options = {}) {
  let time = 100_000;
  const calls = [];
  const sleeps = [];
  const client = createHttpClient({
    delayMs: 0,
    maxRetries: 0,
    now: () => time,
    sleep: async (ms) => { sleeps.push(ms); time += ms; },
    fetchImpl: async (url, init) => {
      calls.push({ url, time, init });
      return handler(url, calls, init);
    },
    ...options,
  });
  return { client, calls, sleeps };
}

describe("robots rules", () => {
  it("uses and merges crawler-specific groups instead of unrelated or wildcard rules", () => {
    const policy = parseRobots(`
      User-agent: *
      Disallow: /
      Crawl-delay: 10
      User-agent: OtherBot
      User-agent: lifelineresourcecrawler
      Disallow: /private
      Allow: /private/help
      Crawl-delay: 1.5
      Sitemap: https://services.ca.gov/sitemap.xml
      User-agent: LifeLineResourceCrawler
      Disallow: /hidden
      Crawl-delay: 2
    `);
    expect(policy.allowed(`${ORIGIN}/benefits`)).toBe(true);
    expect(policy.allowed(`${ORIGIN}/private/records`)).toBe(false);
    expect(policy.allowed(`${ORIGIN}/private/help/apply`)).toBe(true);
    expect(policy.allowed(`${ORIGIN}/hidden`)).toBe(false);
    expect(policy.crawlDelayMs).toBe(2_000);
    expect(policy.sitemaps).toEqual([`${ORIGIN}/sitemap.xml`]);
  });

  it("supports wildcard groups, wildcard paths, end anchors, query strings and allow ties", () => {
    const policy = parseRobots(`
      Disallow: /ignored-before-agent
      User-agent: *
      Disallow: /*.pdf$
      Disallow: /search?*
      Allow: /search?topic=help$
      Disallow: /equal
      Allow: /equal
      Disallow:
    `);
    expect(policy.allowed(`${ORIGIN}/ignored-before-agent`)).toBe(true);
    expect(policy.allowed(`${ORIGIN}/docs/application.pdf`)).toBe(false);
    expect(policy.allowed(`${ORIGIN}/docs/application.pdf?language=es`)).toBe(true);
    expect(policy.allowed(`${ORIGIN}/search?topic=help`)).toBe(true);
    expect(policy.allowed(`${ORIGIN}/search?topic=help&page=2`)).toBe(false);
    expect(policy.allowed(`${ORIGIN}/equal`)).toBe(true);
    expect(policy.allowed(`${ORIGIN}/robots.txt`)).toBe(true);
  });

  it("normalizes unreserved characters and Unicode without decoding encoded slashes", () => {
    const policy = parseRobots(`
      User-agent: *
      Disallow: /caf%C3%A9
      Disallow: /foo/%62ar$
      Disallow: /encoded%2Fslash
      Disallow: /star%2A
      Disallow: /money%24
    `);
    expect(policy.allowed(`${ORIGIN}/café`)).toBe(false);
    expect(policy.allowed(`${ORIGIN}/foo/bar`)).toBe(false);
    expect(policy.allowed(`${ORIGIN}/encoded/slash`)).toBe(true);
    expect(policy.allowed(`${ORIGIN}/encoded%2fslash`)).toBe(false);
    expect(policy.allowed(`${ORIGIN}/star*`)).toBe(false);
    expect(policy.allowed(`${ORIGIN}/money$`)).toBe(false);
  });

  it("does not let sitemap or unknown records terminate grouped user agents", () => {
    const policy = parseRobots(`
      User-agent: LifeLineResourceCrawler
      Sitemap: https://services.ca.gov/sitemap.xml
      Unknown-record: ignored
      User-agent: OtherBot
      Disallow: /private
    `);
    expect(policy.allowed(`${ORIGIN}/private`)).toBe(false);
  });
});

describe("scoped HTTP requests", () => {
  it("rejects an out-of-scope redirect before contacting its destination", async () => {
    const { client, calls } = fixture((url) => url.endsWith("/robots.txt")
      ? response("User-agent: *\nAllow: /")
      : response("", 302, { location: "https://outside.example/private" }));
    await expect(client.get(`${ORIGIN}/help`, { allowUrl: (url) => url.origin === ORIGIN }))
      .rejects.toMatchObject({ code: "SCOPE", url: "https://outside.example/private" });
    expect(calls.map((call) => call.url)).toEqual([`${ORIGIN}/robots.txt`, `${ORIGIN}/help`]);
    expect(calls.every((call) => call.init.redirect === "manual")).toBe(true);
  });

  it("checks robots again before following an allowed redirect", async () => {
    const { client, calls } = fixture((url) => {
      if (url.endsWith("/robots.txt")) return response("User-agent: *\nDisallow: /private");
      return response("", 302, { location: "/private" });
    });
    await expect(client.get(`${ORIGIN}/help`)).rejects.toMatchObject({ code: "ROBOTS_DENIED" });
    expect(calls).toHaveLength(2);
    expect(client.stats.robotsDenied).toBe(1);
  });

  it("reads the destination origin's robots before a cross-origin redirect", async () => {
    const other = "https://county.example";
    const { client, calls } = fixture((url) => {
      if (url === `${ORIGIN}/robots.txt`) return response("");
      if (url === `${other}/robots.txt`) return response("User-agent: *\nDisallow: /");
      return response("", 302, { location: `${other}/help` });
    });
    await expect(client.get(`${ORIGIN}/help`)).rejects.toMatchObject({ code: "ROBOTS_DENIED" });
    expect(calls.map((call) => call.url)).toEqual([
      `${ORIGIN}/robots.txt`, `${ORIGIN}/help`, `${other}/robots.txt`,
    ]);
  });

  it("does not let robots redirect outside its origin", async () => {
    const { client, calls } = fixture(() => response("", 302, { location: "https://outside.example/robots.txt" }));
    const policy = await client.robots(ORIGIN);
    expect(policy.error.code).toBe("SCOPE");
    expect(policy.allowed(`${ORIGIN}/help`)).toBe(false);
    await expect(client.get(`${ORIGIN}/help`)).rejects.toMatchObject({ code: "ROBOTS_UNAVAILABLE" });
    expect(calls).toHaveLength(1);
  });

  it("follows same-origin robots redirects and coalesces concurrent robots requests", async () => {
    const { client, calls } = fixture((url) => {
      if (url.endsWith("/robots.txt")) return response("", 302, { location: "/robot-rules" });
      if (url.endsWith("/robot-rules")) return response("User-agent: *\nDisallow: /private");
      return response("Food assistance");
    });
    const [first, second] = await Promise.all([client.robots(ORIGIN), client.robots(ORIGIN)]);
    expect(first).toBe(second);
    expect(first.allowed(`${ORIGIN}/private`)).toBe(false);
    expect(calls).toHaveLength(2);
  });

  it.each([401, 403, 500, 503])("fails closed when robots returns HTTP %i", async (status) => {
    const { client, calls } = fixture(() => response("", status));
    await expect(client.get(`${ORIGIN}/help`)).rejects.toMatchObject({ code: "ROBOTS_UNAVAILABLE", status });
    expect(calls).toHaveLength(1);
  });

  it.each([404, 410])("allows a page when robots is absent with HTTP %i", async (status) => {
    const { client } = fixture((url) => url.endsWith("robots.txt") ? response("", status) : response("Help"));
    expect((await client.get(`${ORIGIN}/help`)).text).toBe("Help");
  });

  it("fails closed for HTML returned in place of robots rules", async () => {
    const { client } = fixture(() => response("<html>Server error</html>", 200, { "content-type": "text/html" }));
    await expect(client.get(`${ORIGIN}/help`)).rejects.toMatchObject({ code: "ROBOTS_UNAVAILABLE" });
  });

  it("fails closed if robots has a binary MIME type rather than treating its skipped body as empty rules", async () => {
    const { client, calls } = fixture(() => response("User-agent: *\nDisallow: /", 200, { "content-type": "application/octet-stream" }));
    await expect(client.get(`${ORIGIN}/help`)).rejects.toMatchObject({ code: "ROBOTS_UNAVAILABLE" });
    expect(calls).toHaveLength(1);
    expect(client.stats.bytes).toBe(0);
  });

  it("limits redirects and detects loops", async () => {
    const { client, calls } = fixture((url) => response("", 302, {
      location: `/hop-${Number(new URL(url).pathname.slice(5)) + 1}`,
    }));
    await expect(client.get(`${ORIGIN}/hop-0`, { checkRobots: false }))
      .rejects.toMatchObject({ code: "REDIRECT_LIMIT" });
    expect(calls).toHaveLength(6);
    const loop = fixture(() => response("", 302, { location: "/help" }));
    await expect(loop.client.get(`${ORIGIN}/help`, { checkRobots: false }))
      .rejects.toMatchObject({ code: "REDIRECT_LIMIT" });
    expect(loop.calls).toHaveLength(1);
  });

  it("returns a controlled scope error for a malformed redirect", async () => {
    const { client, calls } = fixture(() => response("", 302, { location: "https://[invalid" }));
    await expect(client.get(`${ORIGIN}/help`, { checkRobots: false })).rejects.toMatchObject({ code: "SCOPE", status: 302 });
    expect(calls).toHaveLength(1);
  });
});

describe("polite bounded networking", () => {
  it("spaces requests for one origin across robots, failures, retries, and concurrent pages", async () => {
    const { client, calls } = fixture((url) => {
      if (url.endsWith("robots.txt")) return response("User-agent: *\nCrawl-delay: 2");
      return response("", 404);
    }, { delayMs: 1_000 });
    await Promise.all([client.get(`${ORIGIN}/a`), client.get(`${ORIGIN}/b`)]);
    await client.get(`${ORIGIN}/c`);
    expect(calls.map((call) => call.time)).toEqual([100_000, 102_000, 104_000, 106_000]);
    expect(client.stats.requests).toBe(4);
  });

  it("retries a transient status with Retry-After and a transient network error", async () => {
    const { client, calls } = fixture((_, history) => {
      if (history.length === 1) return response("", 503, { "retry-after": "3" });
      if (history.length === 2) throw new TypeError("Temporary network failure");
      return response("Approved resource");
    }, { maxRetries: 2, delayMs: 1_000 });
    const result = await client.get(`${ORIGIN}/help`, { checkRobots: false });
    expect(result.text).toBe("Approved resource");
    expect(calls.map((call) => call.time)).toEqual([100_000, 103_000, 105_000]);
    expect(client.stats.retries).toBe(2);
  });

  it("does not retry permanent errors and bounds exhausted transient retries", async () => {
    const permanent = fixture(() => response("", 403), { maxRetries: 2 });
    expect((await permanent.client.get(`${ORIGIN}/help`, { checkRobots: false })).status).toBe(403);
    expect(permanent.calls).toHaveLength(1);
    const transient = fixture(() => response("", 503), { maxRetries: 2 });
    expect((await transient.client.get(`${ORIGIN}/help`, { checkRobots: false })).status).toBe(503);
    expect(transient.calls).toHaveLength(3);
  });

  it.each(["UNABLE_TO_VERIFY_LEAF_SIGNATURE", "CERT_HAS_EXPIRED", "ENOTFOUND", "UND_ERR_INVALID_ARG"])(
    "does not retry a permanent structured fetch failure: %s", async (code) => {
      const { client, calls } = fixture(() => {
        throw new TypeError("fetch failed", { cause: Object.assign(new Error("Transport failure"), { code }) });
      }, { maxRetries: 2 });
      await expect(client.get(`${ORIGIN}/help`, { checkRobots: false }))
        .rejects.toMatchObject({ code: "NETWORK", transportCode: code, url: `${ORIGIN}/help` });
      expect(calls).toHaveLength(1);
      expect(client.stats.retries).toBe(0);
    },
  );

  it("still retries recognized transient structured fetch failures", async () => {
    const { client, calls } = fixture((_, history) => {
      if (history.length === 1) {
        throw new TypeError("fetch failed", { cause: Object.assign(new Error("Socket reset"), { code: "ECONNRESET" }) });
      }
      return response("Help");
    }, { maxRetries: 2 });
    expect((await client.get(`${ORIGIN}/help`, { checkRobots: false })).text).toBe("Help");
    expect(calls).toHaveLength(2);
  });

  it.each(["120", new Date(220_000).toUTCString()])("surfaces a long Retry-After without sleeping: %s", async (retryAfter) => {
    const { client, calls, sleeps } = fixture(() => response("", 429, { "retry-after": retryAfter }), { maxRetries: 2 });
    await expect(client.get(`${ORIGIN}/help`, { checkRobots: false })).rejects.toMatchObject({
      code: "RETRY_LATER", status: 429, retryAt: new Date(220_000).toISOString(),
    });
    await expect(client.get(`${ORIGIN}/other`, { checkRobots: false })).rejects.toMatchObject({ code: "RETRY_LATER" });
    expect(calls).toHaveLength(1);
    expect(sleeps).toEqual([]);
  });

  it("enforces a run-wide request budget including retries", async () => {
    const { client, calls } = fixture(() => response("", 503), { maxRequests: 2, maxRetries: 4 });
    await expect(client.get(`${ORIGIN}/help`, { checkRobots: false })).rejects.toMatchObject({ code: "REQUEST_LIMIT" });
    expect(calls).toHaveLength(2);
    expect(client.stats.requests).toBe(2);
  });

  it("preserves the request-budget error when another origin needs robots", async () => {
    const { client } = fixture(() => response("Help"), { maxRequests: 1 });
    await client.get(`${ORIGIN}/help`, { checkRobots: false });
    await expect(client.get("https://other.example/help")).rejects.toMatchObject({ code: "REQUEST_LIMIT" });
  });

  it("allows different origins to make progress independently", async () => {
    let finishFirst;
    let notifyFirstStarted;
    const firstStarted = new Promise((resolve) => { notifyFirstStarted = resolve; });
    const { client } = fixture((url) => {
      if (url.startsWith(ORIGIN)) {
        notifyFirstStarted();
        return new Promise((resolve) => { finishFirst = resolve; });
      }
      return response("Second origin");
    });
    const first = client.get(`${ORIGIN}/help`, { checkRobots: false });
    await firstStarted;
    const second = await client.get("https://other.example/help", { checkRobots: false });
    expect(second.text).toBe("Second origin");
    finishFirst(response("First origin"));
    expect((await first).text).toBe("First origin");
  });

  it("does not retain transient robots failures in another run", async () => {
    const failed = fixture(() => { throw new TypeError("Temporary DNS failure"); });
    await expect(failed.client.get(`${ORIGIN}/help`)).rejects.toMatchObject({ code: "ROBOTS_UNAVAILABLE" });
    const nextRun = fixture((url) => url.endsWith("robots.txt") ? response("") : response("Help"));
    expect((await nextRun.client.get(`${ORIGIN}/help`)).text).toBe("Help");
  });

  it("caps a declared large response before consuming its body", async () => {
    const { client } = fixture(() => response("a small body", 200, { "content-length": "10000" }), { maxBytes: 20 });
    await expect(client.get(`${ORIGIN}/help`, { checkRobots: false })).rejects.toMatchObject({ code: "SIZE_LIMIT" });
    expect(client.stats.bytes).toBe(0);
  });

  it("retains binary response metadata without reading or buffering its body", async () => {
    let canceled = false;
    const binary = new Response(new ReadableStream({
      cancel() { canceled = true; },
    }), { headers: { "content-type": "application/pdf", "content-length": "10000000" } });
    const getReader = vi.spyOn(binary.body, "getReader");
    const { client } = fixture(() => binary, { maxBytes: 20 });
    const result = await client.get(`${ORIGIN}/download?id=12`, { checkRobots: false });
    expect(result).toMatchObject({ status: 200, contentType: "application/pdf", text: "" });
    expect(getReader).not.toHaveBeenCalled();
    expect(canceled).toBe(true);
    expect(client.stats.bytes).toBe(0);
    expect(client.stats.tooLarge).toBe(0);
  });

  it.each(["text/html", "text/plain", "application/xhtml+xml", "application/xml", "application/ld+json", ""])(
    "still reads bounded textual content with MIME %s", async (contentType) => {
      const { client } = fixture(() => response("Readable page", 200, { "content-type": contentType }));
      expect((await client.get(`${ORIGIN}/help`, { checkRobots: false })).text).toBe("Readable page");
      expect(client.stats.bytes).toBe(13);
    },
  );

  it("caps streamed data even when Content-Length is absent", async () => {
    const { client } = fixture(() => response("A body which exceeds twenty bytes."), { maxBytes: 20 });
    await expect(client.get(`${ORIGIN}/help`, { checkRobots: false })).rejects.toMatchObject({ code: "SIZE_LIMIT" });
    expect(client.stats.tooLarge).toBe(1);
  });

  it("times out the body as well as the initial fetch and releases the origin lock", async () => {
    let canceled = false;
    const { client } = fixture((_, calls) => calls.length === 1
      ? new Response(new ReadableStream({ cancel() { canceled = true; } }))
      : response("Next page"), { timeoutMs: 20 });
    await expect(client.get(`${ORIGIN}/slow`, { checkRobots: false })).rejects.toMatchObject({ code: "TIMEOUT" });
    expect(canceled).toBe(true);
    expect((await client.get(`${ORIGIN}/help`, { checkRobots: false })).text).toBe("Next page");
  });

  it("bounds a fetch implementation that never responds", async () => {
    const { client } = fixture(() => new Promise(() => {}), { timeoutMs: 20 });
    await expect(client.get(`${ORIGIN}/slow`, { checkRobots: false })).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("preserves conditional headers and returns normalized response headers for caching", async () => {
    const { client, calls } = fixture(() => new Response(null, { status: 304, headers: { ETag: '"unchanged"' } }));
    const result = await client.get(`${ORIGIN}/help`, { checkRobots: false, headers: { "if-none-match": '"unchanged"' } });
    expect(calls[0].init.headers["if-none-match"]).toBe('"unchanged"');
    expect(calls[0].init.headers["user-agent"]).toContain("LifeLineResourceCrawler");
    expect(result).toMatchObject({ status: 304, text: "", headers: { etag: '"unchanged"' } });
  });
});
