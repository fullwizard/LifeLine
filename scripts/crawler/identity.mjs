/** A conservative identity for repeated program pages with different URLs. */
export function programPageKey(page) {
  const name = String(page.title ?? "")
    .split(/\s+\|\s+/)[0]
    .replace(/\s+-\s+(?:consumer|state of california)\s*$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const metadata = String(page.description ?? "").trim();
  const description = /^(?:state of california|california state government)$/i.test(metadata) || metadata.length < 70
    ? String(page.excerpt ?? "").slice(0, 900)
    : metadata;
  const normalized = description.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  if (name.length < 8 || normalized.length < 70) return null;
  return `${name}\u001f${normalized}`;
}
