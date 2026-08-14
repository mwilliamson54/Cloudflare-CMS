import type { Express } from "express";
import { getSettings, listContentEntries } from "../db";

function xmlEscape(value: string) { return value.replace(/[<>&'\"]/g, character => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[character] ?? character); }

export function registerSeoRoutes(app: Express) {
  app.get("/robots.txt", async (req, res, next) => {
    try {
      const settings = await getSettings("site", true);
      const origin = process.env.CANONICAL_ORIGIN ?? `${req.protocol}://${req.get("host")}`;
      const indexing = settings.siteIndexing !== false;
      res.type("text/plain").send(indexing
        ? `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${origin}/sitemap.xml\n`
        : "User-agent: *\nDisallow: /\n");
    } catch (error) { next(error); }
  });

  app.get("/sitemap.xml", async (req, res, next) => {
    try {
      const settings = await getSettings("site", true);
      const origin = process.env.CANONICAL_ORIGIN ?? `${req.protocol}://${req.get("host")}`;
      if (settings.siteIndexing === false) {
        res.type("application/xml").send("<?xml version=\"1.0\" encoding=\"UTF-8\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\"></urlset>");
        return;
      }
      const [posts, pages] = await Promise.all([
        listContentEntries({ contentTypeKey: "post", publishedOnly: true, perPage: 100 }),
        listContentEntries({ contentTypeKey: "page", publishedOnly: true, perPage: 100 }),
      ]);
      const urls = [
        `<url><loc>${xmlEscape(origin)}</loc></url>`,
        ...posts.entries.filter(entry => entry.robotsIndex).map(entry => `<url><loc>${xmlEscape(`${origin}/blog/${entry.slug}`)}</loc><lastmod>${entry.updatedAt.toISOString()}</lastmod></url>`),
        ...pages.entries.filter(entry => entry.robotsIndex).map(entry => `<url><loc>${xmlEscape(`${origin}/${entry.slug}`)}</loc><lastmod>${entry.updatedAt.toISOString()}</lastmod></url>`),
      ];
      res.setHeader("Cache-Control", "public, max-age=300");
      res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`);
    } catch (error) { next(error); }
  });
}
