/**
 * Small, explicit HTML allowlist for source-mode authoring. It removes active
 * content and event handlers before the source is persisted or rendered.
 */
const allowedTags = new Set(["p", "br", "strong", "em", "b", "i", "u", "s", "a", "ul", "ol", "li", "blockquote", "h1", "h2", "h3", "h4", "figure", "figcaption", "img", "hr", "code", "pre", "span"]);
const allowedAttributes = new Set(["href", "title", "target", "rel", "src", "alt", "width", "height", "class"]);

export function sanitizeRichHtml(source: string | null | undefined): string | null {
  if (!source?.trim()) return null;
  const withoutDangerousBlocks = source.replace(/<(script|style|iframe|object|embed|form|svg|math)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
  return withoutDangerousBlocks.replace(/<\/?([a-z0-9-]+)([^>]*)>/gi, (full, tag: string, attributes: string) => {
    const normalizedTag = tag.toLowerCase();
    const closing = full.startsWith("</");
    if (!allowedTags.has(normalizedTag)) return "";
    if (closing) return `</${normalizedTag}>`;
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
}
