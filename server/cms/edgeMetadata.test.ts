import { describe, expect, it, vi } from "vitest";
import { buildTags, onRequest, resolveEdgeMetadata } from "../../functions/[[path]]";

function context(path: string[], entryOverrides: Record<string, unknown> = {}) {
  const entry = { title: "A <tailored> story", excerpt: "Story excerpt", seo_title: null, seo_description: null, canonical_url: null, robots_index: 1, robots_follow: 1, og_title: null, og_description: null, og_image_url: null, published_at: "2026-08-14T00:00:00.000Z", updated_at: "2026-08-14T01:00:00.000Z", ...entryOverrides };
  const prepare = vi.fn((query: string) => ({ bind: vi.fn(() => ({ first: vi.fn().mockResolvedValue(query.includes("siteTitle") ? { value: '"Atelier Journal"' } : query.includes("siteDescription") ? { value: '"Editorial fashion stories"' } : query.includes("content_entries") ? entry : null) })) }));
  return { request: new Request(`https://atelier.example/${path.join("/")}`), params: { path }, env: { CMS_DB: { prepare }, CMS_ORIGIN: "https://atelier.example" }, next: vi.fn() } as any;
}

describe("Cloudflare Pages public metadata renderer", () => {
  it("derives published article metadata from D1 and emits escaped canonical head tags", async () => {
    const meta = await resolveEdgeMetadata(context(["blog", "tailored-story"]));
    expect(meta).toMatchObject({ title: "A <tailored> story", canonicalPath: "/blog/tailored-story", article: { publishedTime: "2026-08-14T00:00:00.000Z" } });
    const tags = buildTags(meta, "https://atelier.example");
    expect(tags).toContain("A &lt;tailored&gt; story");
    expect(tags).toContain('rel="canonical" href="https://atelier.example/blog/tailored-story"');
    expect(tags).toContain('property="og:type" content="article"');
  });

  it("makes dashboard and preview routes crawler-safe without querying entry data", async () => {
    const meta = await resolveEdgeMetadata(context(["admin", "posts"]));
    expect(meta).toMatchObject({ canonicalPath: "/admin/posts", noindex: true });
  });

  it("preserves absolute canonicals and emits entry-level noindex, nofollow, social overrides, and image URLs", async () => {
    const meta = await resolveEdgeMetadata(context(["blog", "private-story"], { canonical_url: "https://canonical.example/private-story", robots_index: 0, robots_follow: 0, og_title: "Social <title>", og_description: "Social description", og_image_url: "/media/social-image.jpg" }));
    const tags = buildTags(meta, "https://atelier.example");
    expect(tags).toContain('href="https://canonical.example/private-story"');
    expect(tags).toContain('content="noindex, nofollow"');
    expect(tags).toContain('property="og:title" content="Social &lt;title&gt;"');
    expect(tags).toContain('property="og:image" content="https://atelier.example/media/social-image.jpg"');
  });

  it("appends D1-derived metadata to the raw HTML response through the Pages HTML rewriter", async () => {
    const original = (globalThis as any).HTMLRewriter;
    class RewriterDouble {
      private handler: any;
      on(_selector: string, handler: any) { this.handler = handler; return this; }
      transform(response: Response) { let tags = ""; this.handler.element({ append: (value: string) => { tags = value; } }); return new Response(`<html><head>${tags}</head><body>Shell</body></html>`, response); }
    }
    (globalThis as any).HTMLRewriter = RewriterDouble;
    try {
      const input = context(["blog", "tailored-story"]);
      input.next.mockResolvedValue(new Response("<html><head></head><body>Shell</body></html>", { headers: { "content-type": "text/html; charset=utf-8" } }));
      const response = await onRequest(input);
      await expect(response.text()).resolves.toContain('<meta property="og:type" content="article">');
    } finally { (globalThis as any).HTMLRewriter = original; }
  });
});
