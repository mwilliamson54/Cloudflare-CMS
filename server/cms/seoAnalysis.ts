export type SeoAnalysisInput = {
  title: string;
  description?: string | null;
  focusKeyword?: string | null;
  bodyMarkdown?: string | null;
  featuredMediaId?: number | null;
  canonicalUrl?: string | null;
  robotsIndex?: boolean;
};

export type SeoRecommendation = { severity: "high" | "medium" | "low"; message: string };

/** Deterministic per-entry SEO checks suitable for immediate editor feedback. */
export function analyzeSeo(input: SeoAnalysisInput) {
  const body = (input.bodyMarkdown || "").trim();
  const titleLength = input.title.trim().length;
  const descriptionLength = (input.description || "").trim().length;
  const wordCount = body ? body.split(/\s+/).filter(Boolean).length : 0;
  const headings = body.split("\n").filter(line => /^#{1,3}\s+/.test(line)).length;
  const keyword = (input.focusKeyword || "").trim().toLowerCase();
  const haystack = `${input.title} ${input.description || ""} ${body}`.toLowerCase();
  const recommendations: SeoRecommendation[] = [];
  if (titleLength < 20 || titleLength > 60) recommendations.push({ severity: "medium", message: "Keep the SEO title between 20 and 60 characters when practical." });
  if (descriptionLength < 120 || descriptionLength > 160) recommendations.push({ severity: "medium", message: "Add a focused meta description between 120 and 160 characters." });
  if (!keyword) recommendations.push({ severity: "low", message: "Set a focus keyword to evaluate topical alignment." });
  else if (!haystack.includes(keyword)) recommendations.push({ severity: "high", message: "Use the focus keyword naturally in the title, description, or body." });
  if (wordCount < 300) recommendations.push({ severity: "low", message: "Consider expanding this entry beyond 300 words if it targets an informational query." });
  if (wordCount >= 300 && headings === 0) recommendations.push({ severity: "low", message: "Use descriptive headings to improve scanability for longer content." });
  if (!input.featuredMediaId) recommendations.push({ severity: "low", message: "Add a featured image to improve social sharing presentation." });
  if (!input.canonicalUrl) recommendations.push({ severity: "low", message: "Confirm the default permalink is canonical, or provide an explicit canonical URL." });
  if (input.robotsIndex === false) recommendations.push({ severity: "low", message: "This entry is intentionally excluded from indexing." });
  const score = Math.max(0, 100 - recommendations.reduce((total, item) => total + (item.severity === "high" ? 25 : item.severity === "medium" ? 12 : 5), 0));
  return { score, wordCount, headings, recommendations };
}
