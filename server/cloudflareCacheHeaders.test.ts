import { describe, expect, it } from "vitest";
import { onRequestGet as mediaGet } from "../functions/media/[[key]]";
import { onRequestGet as robotsGet } from "../functions/robots.txt";
import { onRequestGet as sitemapGet } from "../functions/sitemap.xml";
import { json } from "../functions/_shared/auth";

describe("Cloudflare cache boundaries", () => {
  it("marks auth and API JSON responses as private no-store", () => {
    expect(json({ ok: true }).headers.get("cache-control")).toBe("no-store");
  });

  it("marks R2 media as immutable public content", async () => {
    const response = await mediaGet({ env: { CMS_MEDIA: { async get() { return { body: "bytes", httpEtag: '"etag"', writeHttpMetadata(headers: Headers) { headers.set("content-type", "image/png"); } }; } } }, params: { key: ["uploads", "test.png"] }, request: new Request("https://cms.example/media/uploads/test.png") });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
  });

  it("marks public robots and sitemap delivery as cacheable", async () => {
    const db = { prepare() { return { async first() { return null; }, async all() { return { results: [] }; } }; } };
    const robots = await robotsGet({ env: { CMS_DB: db, CMS_ORIGIN: "https://atelier-cms.pages.dev" }, request: new Request("https://atelier-cms.pages.dev/robots.txt") });
    const sitemap = await sitemapGet({ env: { CMS_DB: db, CMS_ORIGIN: "https://atelier-cms.pages.dev" }, request: new Request("https://atelier-cms.pages.dev/sitemap.xml") });
    expect(robots.headers.get("cache-control")).toBe("public, max-age=300");
    expect(sitemap.headers.get("cache-control")).toBe("public, max-age=300");
  });
});
