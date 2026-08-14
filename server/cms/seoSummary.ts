import { analyzeSeo, type SeoRecommendation } from "./seoAnalysis";

type SeoSummaryEntry = {
  title: string;
  seoDescription?: string | null;
  excerpt?: string | null;
  focusKeyword?: string | null;
  bodyMarkdown?: string | null;
  featuredMediaId?: number | null;
  canonicalUrl?: string | null;
  robotsIndex?: boolean;
};

/** Aggregates a bounded content sample; callers control the capped query size. */
export function summarizeSeo(entries: SeoSummaryEntry[]) {
  const analyses = entries.map(entry => analyzeSeo({ title: entry.title, description: entry.seoDescription || entry.excerpt, focusKeyword: entry.focusKeyword, bodyMarkdown: entry.bodyMarkdown, featuredMediaId: entry.featuredMediaId, canonicalUrl: entry.canonicalUrl, robotsIndex: entry.robotsIndex }));
  const recommendations = new Map<string, { severity: SeoRecommendation["severity"]; message: string; count: number }>();
  for (const analysis of analyses) for (const item of analysis.recommendations) {
    const existing = recommendations.get(item.message);
    recommendations.set(item.message, existing ? { ...existing, count: existing.count + 1 } : { ...item, count: 1 });
  }
  return {
    sampleSize: analyses.length,
    averageScore: analyses.length ? Math.round(analyses.reduce((total, analysis) => total + analysis.score, 0) / analyses.length) : 0,
    highPriorityCount: analyses.reduce((total, analysis) => total + analysis.recommendations.filter(item => item.severity === "high").length, 0),
    recommendations: Array.from(recommendations.values()).sort((left, right) => right.count - left.count || left.message.localeCompare(right.message)).slice(0, 5),
  };
}
