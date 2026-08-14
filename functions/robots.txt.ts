type Context = { env: { CMS_ORIGIN?: string }; request: Request };
export const onRequestGet = ({ env, request }: Context) => new Response(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${env.CMS_ORIGIN || new URL(request.url).origin}/sitemap.xml\n`, { headers: { "content-type": "text/plain; charset=utf-8" } });
