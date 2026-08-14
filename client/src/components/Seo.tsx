import { useEffect } from "react";

function setMeta(selector: string, attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) { element = document.createElement("meta"); element.setAttribute(attribute, key); document.head.appendChild(element); }
  element.content = content;
}

export function Seo({ title, description, canonicalPath, noindex = false, nofollow = false, image, ogTitle, ogDescription, jsonLd }: { title: string; description: string; canonicalPath: string; noindex?: boolean; nofollow?: boolean; image?: string; ogTitle?: string | null; ogDescription?: string | null; jsonLd?: Record<string, unknown> }) {
  useEffect(() => {
    document.title = title;
    const canonical = new URL(canonicalPath, window.location.origin).toString();
    let canonicalTag = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonicalTag) { canonicalTag = document.createElement("link"); canonicalTag.rel = "canonical"; document.head.appendChild(canonicalTag); }
    canonicalTag.href = canonical;
    setMeta('meta[name="description"]', "name", "description", description);
    setMeta('meta[name="robots"]', "name", "robots", `${noindex ? "noindex" : "index"}, ${nofollow ? "nofollow" : "follow"}`);
    setMeta('meta[property="og:title"]', "property", "og:title", ogTitle || title);
    setMeta('meta[property="og:description"]', "property", "og:description", ogDescription || description);
    setMeta('meta[property="og:url"]', "property", "og:url", canonical);
    if (image) setMeta('meta[property="og:image"]', "property", "og:image", new URL(image, window.location.origin).toString());
    let structuredData = document.head.querySelector<HTMLScriptElement>('script[data-atelier-jsonld="article"]');
    if (jsonLd) { if (!structuredData) { structuredData = document.createElement("script"); structuredData.type = "application/ld+json"; structuredData.dataset.atelierJsonld = "article"; document.head.appendChild(structuredData); } structuredData.text = JSON.stringify(jsonLd); } else structuredData?.remove();
  }, [title, description, canonicalPath, noindex, nofollow, image, ogTitle, ogDescription, jsonLd]);
  return null;
}
