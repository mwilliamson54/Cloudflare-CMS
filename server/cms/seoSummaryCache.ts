import type { summarizeSeo } from "./seoSummary";

type SeoSummary = ReturnType<typeof summarizeSeo>;
type CacheEntry = { expiresAt: number; summary: SeoSummary };
const cache = new Map<number, CacheEntry>();
export const SEO_SUMMARY_CACHE_TTL_MS = 60_000;

export async function getCachedSeoSummary(limit: number, loader: () => Promise<SeoSummary>, now = Date.now()) {
  const cached = cache.get(limit);
  if (cached && cached.expiresAt > now) return cached.summary;
  const summary = await loader();
  cache.set(limit, { summary, expiresAt: now + SEO_SUMMARY_CACHE_TTL_MS });
  return summary;
}

export function invalidateSeoSummaryCache() {
  cache.clear();
}
