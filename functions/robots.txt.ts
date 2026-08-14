type Context = { env: { CMS_DB: any; CMS_ORIGIN?: string }; request: Request };
export const onRequestGet = async ({ env, request }: Context) => {
  const origin = env.CMS_ORIGIN || new URL(request.url).origin;
  const setting = await env.CMS_DB.prepare("SELECT value FROM site_settings WHERE namespace='site' AND key='siteIndexing'").first();
  const indexing = setting?.value !== "false" && setting?.value !== false && setting?.value !== 0;
  const body = indexing
    ? `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${origin}/sitemap.xml\n`
    : "User-agent: *\nDisallow: /\n";
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=300" } });
};
