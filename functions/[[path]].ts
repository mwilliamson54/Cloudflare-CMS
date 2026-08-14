type D1 = { prepare(query: string): { bind(...values: unknown[]): { first<T = Record<string, unknown>>(): Promise<T | null> } } };
type Env = { CMS_DB: D1; CMS_ORIGIN?: string };
type Context = { request: Request; env: Env; params: { path?: string[] | string }; next(): Promise<Response> };
type EdgeMeta = { title: string; description: string; canonicalPath: string; noindex?: boolean; follow?: boolean; ogTitle?: string | null; ogDescription?: string | null; ogImage?: string | null; article?: { publishedTime?: string; modifiedTime?: string } };

const fallback = { title: "Atelier Journal", description: "An independent journal of fashion, culture, and considered living." };
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
const compact = (value: string, max: number) => Array.from(value.replace(/\s+/g, " ").trim()).slice(0, max).join("");
const pathSegments = (context: Context) => Array.isArray(context.params.path) ? context.params.path : context.params.path ? context.params.path.split("/") : [];
const absoluteUrl = (value: string | null | undefined, origin?: string) => !value ? undefined : /^https?:\/\//i.test(value) ? value : origin ? `${origin.replace(/\/$/, "")}${value.startsWith("/") ? value : `/${value}`}` : undefined;

function setting(value: unknown, fallbackValue: string) {
  try { return typeof value === "string" ? String(JSON.parse(value)) : fallbackValue; } catch { return fallbackValue; }
}

async function siteMeta(context: Context) {
  const rows = await Promise.all([
    context.env.CMS_DB.prepare("SELECT value FROM site_settings WHERE namespace='site' AND key='siteTitle' LIMIT 1").bind().first<{ value: string }>(),
    context.env.CMS_DB.prepare("SELECT value FROM site_settings WHERE namespace='site' AND key='siteDescription' LIMIT 1").bind().first<{ value: string }>(),
  ]);
  return { title: setting(rows[0]?.value, fallback.title), description: setting(rows[1]?.value, fallback.description) };
}

export async function resolveEdgeMetadata(context: Context): Promise<EdgeMeta> {
  const pathname = new URL(context.request.url).pathname.replace(/\/+$/, "") || "/";
  const [first, second] = pathSegments(context);
  const site = await siteMeta(context);
  if (pathname.startsWith("/admin") || pathname.startsWith("/preview") || pathname.startsWith("/search")) return { ...site, canonicalPath: pathname, noindex: true };
  const contentRoute = first === "blog" ? "post" : first === "page" ? "page" : null;
  if (contentRoute && second) {
    const entry = await context.env.CMS_DB.prepare("SELECT e.title,e.excerpt,e.seo_title,e.seo_description,e.canonical_url,e.robots_index,e.robots_follow,e.og_title,e.og_description,m.url AS og_image_url,e.published_at,e.updated_at FROM content_entries e JOIN content_types t ON t.id=e.content_type_id LEFT JOIN media m ON m.id=e.og_image_media_id WHERE t.key=? AND e.slug=? AND e.status='published' AND e.trashed_at IS NULL LIMIT 1").bind(contentRoute, second).first<Record<string, string | number | null>>();
    if (entry) return { title: String(entry.seo_title || entry.title || site.title), description: String(entry.seo_description || entry.excerpt || site.description), canonicalPath: String(entry.canonical_url || pathname), noindex: Number(entry.robots_index) === 0, follow: Number(entry.robots_follow) !== 0, ogTitle: entry.og_title ? String(entry.og_title) : null, ogDescription: entry.og_description ? String(entry.og_description) : null, ogImage: entry.og_image_url ? String(entry.og_image_url) : null, article: contentRoute === "post" ? { publishedTime: entry.published_at ? String(entry.published_at) : undefined, modifiedTime: entry.updated_at ? String(entry.updated_at) : undefined } : undefined };
  }
  if ((first === "category" || first === "tag") && second) {
    const table = first === "category" ? "categories" : "tags";
    const taxonomy = await context.env.CMS_DB.prepare(`SELECT name,seo_title,seo_description,robots_index FROM ${table} WHERE slug=? LIMIT 1`).bind(second).first<Record<string, string | number | null>>();
    if (taxonomy) return { title: String(taxonomy.seo_title || `${taxonomy.name} | ${site.title}`), description: String(taxonomy.seo_description || site.description), canonicalPath: pathname, noindex: Number(taxonomy.robots_index) === 0 };
  }
  if (pathname === "/blog") return { title: `Stories | ${site.title}`, description: site.description, canonicalPath: pathname };
  return { ...site, canonicalPath: pathname };
}

export function buildTags(meta: EdgeMeta, origin?: string) {
  const title = escapeHtml(compact(meta.title || fallback.title, 70));
  const description = escapeHtml(compact(meta.description || fallback.description, 200));
  const ogTitle = escapeHtml(compact(meta.ogTitle || meta.title || fallback.title, 70));
  const ogDescription = escapeHtml(compact(meta.ogDescription || meta.description || fallback.description, 200));
  const canonical = absoluteUrl(meta.canonicalPath, origin);
  const image = absoluteUrl(meta.ogImage, origin);
  const tags = [`<title>${title}</title>`, `<meta name="description" content="${description}">`, `<meta property="og:type" content="${meta.article ? "article" : "website"}">`, `<meta property="og:title" content="${ogTitle}">`, `<meta property="og:description" content="${ogDescription}">`, `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">`, `<meta name="twitter:title" content="${ogTitle}">`, `<meta name="twitter:description" content="${ogDescription}">`];
  if (canonical) tags.push(`<link rel="canonical" href="${escapeHtml(canonical)}">`, `<meta property="og:url" content="${escapeHtml(canonical)}">`);
  if (image) tags.push(`<meta property="og:image" content="${escapeHtml(image)}">`, `<meta name="twitter:image" content="${escapeHtml(image)}">`);
  if (meta.noindex || meta.follow === false) tags.push(`<meta name="robots" content="${meta.noindex ? "noindex" : "index"}, ${meta.follow === false ? "nofollow" : "follow"}">`);
  if (meta.article?.publishedTime) tags.push(`<meta property="article:published_time" content="${escapeHtml(meta.article.publishedTime)}">`);
  if (meta.article?.modifiedTime) tags.push(`<meta property="article:modified_time" content="${escapeHtml(meta.article.modifiedTime)}">`);
  return tags.join("");
}

export const onRequest = async (context: Context) => {
  const response = await context.next();
  if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) return response;
  const pathname = new URL(context.request.url).pathname.replace(/\/+$/, "") || "/";
  const meta = await resolveEdgeMetadata(context).catch(() => ({ ...fallback, canonicalPath: pathname, noindex: pathname.startsWith("/admin") || pathname.startsWith("/preview") || pathname.startsWith("/search") }));
  const Rewriter = (globalThis as any).HTMLRewriter;
  if (!Rewriter) return response;
  return new Rewriter().on("head", { element(element: { append(content: string, options: { html: boolean }): void }) { element.append(buildTags(meta, context.env.CMS_ORIGIN), { html: true }); } }).transform(response);
};
