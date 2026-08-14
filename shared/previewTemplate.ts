export type PreviewTemplateKey = "default" | "landing" | "narrative" | "lookbook" | "minimal";
export type PreviewHeroVariant = "hero" | "cardOne" | "cardTwo";

export function resolvePreviewTemplate(templateKey?: string | null) {
  const template: PreviewTemplateKey = templateKey === "landing" || templateKey === "narrative" || templateKey === "lookbook" || templateKey === "minimal" ? templateKey : "default";
  return {
    template,
    showHero: template !== "minimal",
    heroVariant: (template === "lookbook" ? "cardOne" : template === "narrative" ? "cardTwo" : "hero") as PreviewHeroVariant,
    eyebrow: template === "lookbook" ? "Lookbook" : template === "landing" ? "Landing page" : template === "narrative" ? "Longform narrative" : "Preview",
    headlineClass: template === "minimal" ? "max-w-3xl text-5xl md:text-6xl" : template === "landing" ? "max-w-5xl text-6xl md:text-8xl" : "max-w-4xl text-5xl md:text-7xl",
    contentClass: template === "narrative" ? "max-w-3xl" : "max-w-4xl",
  };
}
