/**
 * Small, explicit HTML allowlist for source-mode authoring. It removes active
 * content and event handlers before the source is persisted or rendered.
 */
const allowedTags = new Set(["p", "br", "strong", "em", "b", "i", "u", "s", "a", "ul", "ol", "li", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "figure", "figcaption", "img", "hr", "code", "pre", "span", "table", "thead", "tbody", "tr", "th", "td", "aside", "iframe"]);
const allowedAttributes = new Set(["href", "title", "target", "rel", "src", "alt", "width", "height", "class"]);
const trustedEmbedHosts = new Set(["www.youtube.com", "www.youtube-nocookie.com", "player.vimeo.com", "open.spotify.com", "www.instagram.com"]);

function trustedEmbedSource(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && trustedEmbedHosts.has(url.hostname.toLowerCase()) ? url.toString() : null;
  } catch {
    return null;
  }
}

export function sanitizeRichHtml(source: string | null | undefined): string | null {
  if (!source?.trim()) return null;
  const withoutDangerousBlocks = source
    .replace(/<(script|style|object|embed|form|svg|math)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<iframe\b([^>]*)>[\s\S]*?<\/iframe\s*>/gi, (_full, attributes: string) => {
      const srcMatch = attributes.match(/\bsrc\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+)/i);
      return trustedEmbedSource(srcMatch?.[1]?.replace(/^['"]|['"]$/g, "") || "") ? `<iframe${attributes}></iframe>` : "";
    });
  const sanitized = withoutDangerousBlocks.replace(/<\/?([a-z0-9-]+)([^>]*)>/gi, (full, tag: string, attributes: string) => {
    const normalizedTag = tag.toLowerCase();
    const closing = full.startsWith("</");
    if (!allowedTags.has(normalizedTag)) return "";
    if (closing) return `</${normalizedTag}>`;
    if (normalizedTag === "iframe") {
      const srcMatch = attributes.match(/\bsrc\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+)/i);
      const titleMatch = attributes.match(/\btitle\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+)/i);
      const src = trustedEmbedSource(srcMatch?.[1]?.replace(/^['"]|['"]$/g, "") || "");
      if (!src) return "";
      const title = (titleMatch?.[1]?.replace(/^['"]|['"]$/g, "") || "Embedded media").replace(/"/g, "&quot;");
      return `<iframe src="${src.replace(/"/g, "&quot;")}" title="${title}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation">`;
    }
    const safeAttributes: string[] = [];
    attributes.replace(/([a-zA-Z0-9:-]+)\s*(?:=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g, (_: string, rawName: string, rawValue = "") => {
      const name = rawName.toLowerCase();
      const value = rawValue.replace(/^['"]|['"]$/g, "");
      if (!allowedAttributes.has(name) || name.startsWith("on")) return "";
      if ((name === "href" || name === "src") && /^\s*(javascript:|data:text\/html)/i.test(value)) return "";
      if (name === "target" && value !== "_blank") return "";
      if (name === "class" && !/^[a-zA-Z0-9_\-\s]+$/.test(value)) return "";
      safeAttributes.push(`${name}="${value.replace(/"/g, "&quot;")}"`);
      return "";
    });
    if (normalizedTag === "a" && safeAttributes.some(attribute => attribute.startsWith("target=\"_blank")) && !safeAttributes.some(attribute => attribute.startsWith("rel="))) safeAttributes.push('rel="noopener noreferrer"');
    return `<${normalizedTag}${safeAttributes.length ? ` ${safeAttributes.join(" ")}` : ""}>`;
  });
  return sanitized.trim() || null;
}
