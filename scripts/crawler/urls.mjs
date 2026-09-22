/** Shared URL policy: preserve meaningful query parameters, discard tracking. */
export function normalizeUrl(value, base) {
  try {
    const url = new URL(value, base);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_.+|fbclid|gclid|msclkid|mc_cid|mc_eid)$/i.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    return url.href;
  } catch {
    return null;
  }
}

export function hasAllowedPath(url, source) {
  const path = url.pathname.toLowerCase();
  return source.allowedPathPrefixes.some((raw) => {
    const prefix = raw.toLowerCase().replace(/\/$/, "");
    return !prefix || path === prefix || path.startsWith(`${prefix}/`);
  });
}

export function inSourceScope(value, source) {
  const normalized = normalizeUrl(value);
  if (!normalized) return false;
  const url = new URL(normalized);
  return source.allowedOrigins.includes(url.origin) && hasAllowedPath(url, source);
}

export function documentKind(value) {
  const path = new URL(value).pathname;
  if (/\.(pdf|docx?|xlsx?|csv|rtf|odt)$/i.test(path)) return "document";
  if (/\.(jpe?g|png|gif|webp|svg|ico|css|js|woff2?|ttf|mp[34]|avi|zip|gz|exe)$/i.test(path)) return "asset";
  return "page";
}

export function crawlTrap(value) {
  const url = new URL(value);
  return /\/(search|search-results|calendar|user|login|logout|sign-in|cart)(\/|$)/i.test(url.pathname)
    || [...url.searchParams.keys()].some((key) => /^(s|q|search|sort|order|session|sessionid|sid|replytocom)$/i.test(key));
}

/** A queue preference, never a rule for publishing eligibility. */
export function linkPriority(link) {
  const text = `${link.text ?? ""} ${new URL(link.url).pathname}`.replace(/[-_/]/g, " ").toLowerCase();
  let score = link.navigation ? -6 : 2;
  if (/\b(apply|eligibility|get help|assistance|benefits?|programs?|services?|resources?)\b/.test(text)) score += 10;
  if (/\b(housing|rent|food|calfresh|utilities|energy|shelter|employment|training|legal|health|medi cal|disability|veterans?|children|care|support|transportation|cancer|diabetes|hiv)\b/.test(text)) score += 8;
  if (/\b(news|press|agenda|minutes|procurement|contracts?|budget|reports?|about|contact us|privacy)\b/.test(text)) score -= 12;
  return score;
}

/** Provider/contact links are evidence even when they are low-priority crawl targets. */
export function usefulLead(link) {
  if (link.navigation) return false;
  const url = new URL(link.url);
  if (/(^|\.)(facebook\.com|twitter\.com|x\.com|instagram\.com|linkedin\.com|youtube\.com|youtu\.be|tiktok\.com|pinterest\.com|addtoany\.com|sharethis\.com)$/.test(url.hostname)) return false;
  if (/\/(share|sharer|sharer.php|feed)(\/|$)/i.test(url.pathname)) return false;
  return true;
}
