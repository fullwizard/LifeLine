import { afterEach, expect, it } from "vitest";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createPageCache, writeJsonAtomic } from "./cache.mjs";

const temporaryDirectories = [];
async function directory() {
  const path = await mkdtemp(join(tmpdir(), "lifeline-crawler-test-"));
  temporaryDirectories.push(path);
  return path;
}
afterEach(async () => {
  for (const path of temporaryDirectories.splice(0)) await rm(path, { recursive: true, force: true });
});

it("reuses public HTML and validators, handles damaged cache entries, and leaves no partial files", async () => {
  const path = await directory();
  const cache = createPageCache(path);
  const url = "https://example.ca.gov/program";
  const response = { url, text: "<main>Apply for food help</main>", contentType: "text/html", headers: { etag: '"v2"', "last-modified": "Mon, 21 Sep 2026 00:00:00 GMT" } };
  expect(await cache.read(url)).toBeNull();
  await cache.write(url, response);
  expect(await cache.read(url)).toMatchObject({ requestUrl: url, text: response.text, etag: '"v2"' });
  const files = await readdir(path);
  expect(files).toHaveLength(1);
  expect(files[0].endsWith(".json")).toBe(true);
  await writeFile(join(path, files[0]), "interrupted JSON");
  expect(await cache.read(url)).toBeNull();
});

it("atomically replaces an existing report and disabled caches perform no writes", async () => {
  const path = await directory();
  const output = join(path, "report.json");
  await writeJsonAtomic(output, { complete: false });
  await writeJsonAtomic(output, { complete: true });
  expect(await readdir(path)).toEqual(["report.json"]);
  const cache = createPageCache(null);
  await cache.write("https://example.ca.gov", {});
  expect(await cache.read("https://example.ca.gov")).toBeNull();
});
