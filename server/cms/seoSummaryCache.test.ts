import { describe, expect, it, vi } from "vitest";
import { getCachedSeoSummary, invalidateSeoSummaryCache, SEO_SUMMARY_CACHE_TTL_MS } from "./seoSummaryCache";

describe("aggregate SEO summary cache", () => {
  it("reuses a bounded summary until its TTL expires and refreshes deterministically", async () => {
    invalidateSeoSummaryCache();
    const loader = vi.fn().mockResolvedValue({ sampleSize: 1, averageScore: 90, highPriorityCount: 0, recommendations: [] });
    await getCachedSeoSummary(50, loader, 1_000);
    await getCachedSeoSummary(50, loader, 1_001);
    await getCachedSeoSummary(50, loader, 1_000 + SEO_SUMMARY_CACHE_TTL_MS + 1);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("invalidates all cached limits after an editorial write", async () => {
    invalidateSeoSummaryCache();
    const loader = vi.fn().mockResolvedValue({ sampleSize: 1, averageScore: 90, highPriorityCount: 0, recommendations: [] });
    await getCachedSeoSummary(25, loader, 1_000);
    invalidateSeoSummaryCache();
    await getCachedSeoSummary(25, loader, 1_001);
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
