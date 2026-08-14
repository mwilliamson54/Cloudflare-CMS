type Context = { env: { CMS_DB: any; CMS_ORIGIN?: string }; request: Request };
export const onRequestGet = async ({ env, request }: Context) => {
  const origin = env.CMS_ORIGIN || new URL(request.url).origin;
  const settings = await env.CMS_DB.prepare("SELECT value FROM site_settings WHERE namespace='site' AND key='siteIndexing'").first();
  if (settings?.value === "false") return new Response("<?xml version=\"1.0\" encoding=\"UTF-8\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\"></urlset>", { headers: { "content-type": "application/xml" } });
  const entries = await env.CMS_DB.prepare("SELECT e.slug,e.updated_at,t.key FROM content_entries e JOIN content_types t ON t.id=e.content_type_id WHERE e.status='published' AND e.robots_index=1").all();
  const urls = [`<url><loc>${origin}</loc></url>`, ...entries.results.map((entry: any) => `<url><loc>${origin}/${entry.key === "post" ? "blog/" : ""}${encodeURIComponent(entry.slug)}</loc><lastmod>${entry.updated_at}</lastmod></url>`)].join("");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=300" } });
};
