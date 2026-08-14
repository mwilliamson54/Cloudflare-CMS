type Env = { CMS_DB: any; CMS_MEDIA: any; CMS_JWT_SECRET: string; CMS_ORIGIN?: string };
type Context = { request: Request; env: Env; params: { path?: string[] | string } };

const json = (body: unknown, status = 200, headers: HeadersInit = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } });
const wpError = (status: number, code: string, message: string) => json({ code, message, data: { status } }, status);
const textEncoder = new TextEncoder();
const fromBase64Url = (value: string) => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4)), character => character.charCodeAt(0));
const toBase64 = (bytes: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(bytes)));

async function sha256(value: string) { return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", textEncoder.encode(value))), byte => byte.toString(16).padStart(2, "0")).join(""); }
async function verifyJwt(token: string, secret: string) {
  const [head, payload, signature] = token.split("."); if (!head || !payload || !signature) throw new Error("Malformed token");
  const key = await crypto.subtle.importKey("raw", textEncoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("HMAC", key, fromBase64Url(signature), textEncoder.encode(`${head}.${payload}`));
  if (!valid) throw new Error("Invalid token signature");
  const claims = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
  if (!claims.sub || !claims.jti || !claims.role || !Array.isArray(claims.scopes) || (claims.exp && claims.exp * 1000 <= Date.now())) throw new Error("Invalid token claims");
  return claims as { sub: string; jti: string; role: "admin" | "editor" | "viewer"; scopes: string[] };
}
async function requireToken(context: Context, scope: string) {
  const token = context.request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]; if (!token) throw new Error("A bearer token is required.");
  const claims = await verifyJwt(token, context.env.CMS_JWT_SECRET); const hash = await sha256(token);
  const record = await context.env.CMS_DB.prepare("SELECT * FROM api_tokens WHERE token_id=? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > ?)").bind(claims.jti, new Date().toISOString()).first();
  if (!record || record.token_hash !== hash || Number(record.user_id) !== Number(claims.sub) || !claims.scopes.includes(scope)) throw new Error("This API token is invalid, revoked, or missing its required scope.");
  await context.env.CMS_DB.prepare("UPDATE api_tokens SET last_used_at=? WHERE token_id=?").bind(new Date().toISOString(), claims.jti).run();
  return claims;
}
function segments(context: Context) { const path = context.params.path; return Array.isArray(path) ? path : path ? path.split("/") : []; }
function html(markdown: string | null) { return (markdown || "").split(/\n{2,}/).map(part => `<p>${part.replace(/[&<>]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char] || char).replace(/\n/g, "<br>")}</p>`).join(""); }
async function resourceList(context: Context, resource: string) {
  const page = Math.max(1, Number(new URL(context.request.url).searchParams.get("page")) || 1); const perPage = Math.min(100, Math.max(1, Number(new URL(context.request.url).searchParams.get("per_page")) || 10));
  if (resource === "posts" || resource === "pages") {
    const key = resource === "posts" ? "post" : "page"; const count = await context.env.CMS_DB.prepare("SELECT COUNT(*) AS total FROM content_entries e JOIN content_types t ON t.id=e.content_type_id WHERE t.key=? AND e.status='published'").bind(key).first();
    const rows = await context.env.CMS_DB.prepare("SELECT e.* FROM content_entries e JOIN content_types t ON t.id=e.content_type_id WHERE t.key=? AND e.status='published' ORDER BY e.published_at DESC, e.updated_at DESC LIMIT ? OFFSET ?").bind(key, perPage, (page - 1) * perPage).all();
    return json(rows.results.map((entry: any) => ({ id: entry.id, date: entry.published_at || entry.created_at, modified: entry.updated_at, slug: entry.slug, status: entry.status, type: key, link: `/blog/${entry.slug}`, title: { rendered: entry.title }, content: { rendered: html(entry.body_markdown), raw: entry.body_markdown || "" }, excerpt: { rendered: html(entry.excerpt), raw: entry.excerpt || "" }, author: entry.author_id, featured_media: entry.featured_media_id || 0, meta: { seo_title: entry.seo_title, seo_description: entry.seo_description, canonical_url: entry.canonical_url, robots_index: Boolean(entry.robots_index), robots_follow: Boolean(entry.robots_follow) } })), 200, { "X-WP-Total": String(count?.total || 0), "X-WP-TotalPages": String(Math.max(1, Math.ceil(Number(count?.total || 0) / perPage))) });
  }
  if (resource === "categories" || resource === "tags") return json((await context.env.CMS_DB.prepare(`SELECT * FROM ${resource} ORDER BY name`).all()).results);
  if (resource === "media") return json((await context.env.CMS_DB.prepare("SELECT * FROM media ORDER BY created_at DESC LIMIT ? OFFSET ?").bind(perPage, (page - 1) * perPage).all()).results);
  return wpError(404, "rest_no_route", "No route was found matching the URL and request method.");
}
export const onRequestGet = async (context: Context) => {
  const [resource, id] = segments(context); if (!resource) return wpError(404, "rest_no_route", "No route was found matching the URL and request method.");
  if (!id) return resourceList(context, resource); if (resource !== "posts" && resource !== "pages") return wpError(404, "rest_no_route", "No route was found matching the URL and request method.");
  const key = resource === "posts" ? "post" : "page"; const entry = await context.env.CMS_DB.prepare("SELECT e.* FROM content_entries e JOIN content_types t ON t.id=e.content_type_id WHERE t.key=? AND (e.id=? OR e.slug=?) AND e.status='published' LIMIT 1").bind(key, id, id).first();
  return entry ? json({ id: entry.id, date: entry.published_at || entry.created_at, modified: entry.updated_at, slug: entry.slug, status: entry.status, type: key, link: `/blog/${entry.slug}`, title: { rendered: entry.title }, content: { rendered: html(entry.body_markdown), raw: entry.body_markdown || "" }, excerpt: { rendered: html(entry.excerpt), raw: entry.excerpt || "" }, author: entry.author_id, featured_media: entry.featured_media_id || 0 }) : wpError(404, "rest_post_invalid_id", "Invalid post ID.");
};
export const onRequestPost = async (context: Context) => {
  const [resource] = segments(context); const input = await context.request.json<any>();
  try {
    if (resource === "posts" || resource === "pages") { const claims = await requireToken(context, "content:write"); const status = ["draft","scheduled","published","archived"].includes(input.status) ? input.status : "draft"; if ((status === "published" || status === "scheduled") && claims.role === "viewer") return wpError(403, "cms_forbidden", "This API token does not grant publishing access."); const type = resource === "posts" ? "post" : "page"; const typeRow = await context.env.CMS_DB.prepare("SELECT id FROM content_types WHERE key=?").bind(type).first(); if (!typeRow || !input.title || !input.slug) return wpError(400, "rest_invalid_param", "title and slug are required."); const now = new Date().toISOString(); const result = await context.env.CMS_DB.prepare("INSERT INTO content_entries (content_type_id,author_id,title,slug,excerpt,body_markdown,status,scheduled_at,published_at,seo_title,seo_description,canonical_url,robots_index,robots_follow,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(typeRow.id, Number(claims.sub), String(input.title.raw || input.title), String(input.slug), input.excerpt?.raw || input.excerpt || null, input.content?.raw || input.content || "", status, status === "scheduled" ? input.date : null, status === "published" ? now : null, input.meta?.seo_title || null, input.meta?.seo_description || null, input.meta?.canonical_url || null, input.meta?.robots_index === false ? 0 : 1, input.meta?.robots_follow === false ? 0 : 1, now, now).run(); return json({ id: result.meta.last_row_id, status, slug: input.slug, title: { rendered: input.title.raw || input.title } }, 201); }
    if (resource === "media") { const claims = await requireToken(context, "media:write"); if (!input.fileName || !input.mimeType || !input.dataBase64) return wpError(400, "rest_upload_invalid", "fileName, mimeType, and dataBase64 are required."); const bytes = fromBase64Url(String(input.dataBase64).replace(/\+/g, "-").replace(/\//g, "_")); if (bytes.byteLength > 10 * 1024 * 1024) return wpError(413, "rest_upload_too_large", "Media uploads must be 10 MB or smaller."); const key = `cms-media/${crypto.randomUUID()}-${String(input.fileName).replace(/[^a-zA-Z0-9._-]/g, "-")}`; await context.env.CMS_MEDIA.put(key, bytes, { httpMetadata: { contentType: input.mimeType } }); const url = `/media/${encodeURIComponent(key)}`; const result = await context.env.CMS_DB.prepare("INSERT INTO media (storage_key,url,file_name,mime_type,size_bytes,alt_text,title,uploaded_by_id) VALUES (?,?,?,?,?,?,?,?)").bind(key,url,input.fileName,input.mimeType,bytes.byteLength,input.alt_text || null,input.title || null,Number(claims.sub)).run(); return json({ id: result.meta.last_row_id, source_url: url, alt_text: input.alt_text || "" },201); }
    return wpError(404,"rest_no_route","No route was found matching the URL and request method.");
  } catch (error) { return wpError(401, "cms_unauthorized", error instanceof Error ? error.message : "Authentication failed."); }
};
