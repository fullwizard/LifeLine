import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

/** Cache raw public HTML so updated extraction rules run again on HTTP 304. */
export function createPageCache(directory) {
  const pathFor = (url) => join(directory, `${createHash("sha256").update(url).digest("hex")}.json`);
  return {
    async read(url) {
      if (!directory) return null;
      try {
        const entry = JSON.parse(await readFile(pathFor(url), "utf8"));
        if (entry.version !== 1 || entry.requestUrl !== url || typeof entry.text !== "string"
          || entry.text.length > 2 * 1024 * 1024 || typeof entry.url !== "string") return null;
        return entry;
      } catch {
        return null;
      }
    },
    async write(url, response) {
      if (!directory) return;
      await writeJsonAtomic(pathFor(url), {
        version: 1,
        requestUrl: url,
        url: response.url,
        fetchedAt: new Date().toISOString(),
        etag: response.headers.etag,
        lastModified: response.headers["last-modified"],
        contentType: response.contentType,
        text: response.text,
      });
    },
  };
}
