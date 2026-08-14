import { describe, expect, it } from "vitest";
import { summarizeSeo } from "./seoSummary";

describe("bounded SEO summary", () => {
  it("aggregates deterministic entry checks without retaining entry content", () => {
    const summary = summarizeSeo([
      { title: "Short", seoDescription: null, bodyMarkdown: "Brief body", featuredMediaId: null, canonicalUrl: null, robotsIndex: true },
      { title: "Another short", seoDescription: null, bodyMarkdown: "Brief body", featuredMediaId: null, canonicalUrl: null, robotsIndex: true },
    ]);
    expect(summary).toMatchObject({ sampleSize: 2, highPriorityCount: 0 });
    expect(summary.recommendations[0]).toMatchObject({ count: 2 });
  });

  it("returns a stable empty summary", () => {
    expect(summarizeSeo([])).toEqual({ sampleSize: 0, averageScore: 0, highPriorityCount: 0, recommendations: [] });
  });
});
