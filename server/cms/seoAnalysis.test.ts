import { describe, expect, it } from "vitest";
import { analyzeSeo } from "./seoAnalysis";

describe("SEO analysis", () => {
  it("identifies missing metadata, keyword coverage, content structure, and social media signals", () => {
    const analysis = analyzeSeo({ title: "Short", description: "", focusKeyword: "tailoring", bodyMarkdown: "A brief note." });
    expect(analysis.score).toBeLessThan(70);
    expect(analysis.recommendations.map(item => item.message).join(" ")).toMatch(/meta description|focus keyword|featured image/i);
  });

  it("returns a high score for complete, structured editorial content", () => {
    const body = `# A considered heading\n\n${"tailoring ".repeat(330)}`;
    const analysis = analyzeSeo({ title: "Quiet tailoring for a considered wardrobe", description: "An editorial guide to thoughtful tailoring, proportion, and the pieces that remain relevant through each season.", focusKeyword: "tailoring", bodyMarkdown: body, featuredMediaId: 1, canonicalUrl: "https://example.com/blog/tailoring", robotsIndex: true });
    expect(analysis.score).toBeGreaterThan(85);
  });
});
