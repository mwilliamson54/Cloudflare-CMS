import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { prefetchForPath, type SsrPrefetch } from "../../client/src/ssr/prefetch";

function prefetch(overrides: Partial<SsrPrefetch> = {}): SsrPrefetch {
  return {
    settings: vi.fn().mockResolvedValue({ siteTitle: "Atelier Journal", siteDescription: "Independent fashion coverage." }),
    menus: vi.fn().mockResolvedValue([]),
    posts: vi.fn().mockResolvedValue({ entries: [], total: 0 }),
    post: vi.fn().mockResolvedValue(null),
    page: vi.fn().mockResolvedValue(null),
    categoryPosts: vi.fn().mockResolvedValue([]),
    tagPosts: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe("public SSR prefetch contract", () => {
  it("seeds the homepage with the exact published-post input and canonical metadata", async () => {
    const p = prefetch();
    const head = await prefetchForPath("/", new QueryClient(), p);

    expect(p.posts).toHaveBeenCalledWith({ perPage: 100 });
    expect(head).toMatchObject({ canonicalPath: "/" });
    expect(head.noindex).toBeUndefined();
    expect(head.notFound).toBeUndefined();
  });

  it("uses per-entry SEO fields for an article head and preserves noindex", async () => {
    const p = prefetch({ post: vi.fn().mockResolvedValue({ title: "A quiet silhouette", excerpt: "Tailoring in motion.", seoTitle: "Quiet tailoring", seoDescription: "A considered study.", canonicalUrl: "/journal/quiet-tailoring", robotsIndex: false, publishedAt: new Date("2026-08-14T00:00:00.000Z"), updatedAt: new Date("2026-08-14T10:00:00.000Z") }) });
    const head = await prefetchForPath("/blog/quiet-tailoring", new QueryClient(), p);

    expect(p.post).toHaveBeenCalledWith("quiet-tailoring");
    expect(head).toMatchObject({ title: "Quiet tailoring", description: "A considered study.", canonicalPath: "/journal/quiet-tailoring", ogType: "article", noindex: true });
  });

  it("returns a true 404 head only for unknown public paths and allows gated routes as noindex shells", async () => {
    const p = prefetch();
    await expect(prefetchForPath("/does-not-exist", new QueryClient(), p)).resolves.toMatchObject({ notFound: true });
    const gated = await prefetchForPath("/admin/posts", new QueryClient(), p);
    expect(gated).toMatchObject({ noindex: true });
    expect(gated.notFound).toBeUndefined();
  });
});
