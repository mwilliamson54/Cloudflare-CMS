import { describe, expect, it, vi } from "vitest";
import { onRequestGet } from "../../functions/sitemap.xml";

describe("Cloudflare sitemap function", () => {
  it("filters trashed published entries before generating crawler-visible URLs", async () => {
    const prepare = vi.fn((query: string) => {
      if (query.includes("siteIndexing")) return { first: vi.fn().mockResolvedValue({ value: "true" }) };
      return { all: vi.fn().mockResolvedValue({ results: [{ slug: "visible-story", updated_at: "2026-08-14T00:00:00.000Z", key: "post" }] }) };
    });

    const response = await onRequestGet({ env: { CMS_DB: { prepare }, CMS_ORIGIN: "https://atelier.example" }, request: new Request("https://atelier.example/sitemap.xml") });

    expect(prepare).toHaveBeenLastCalledWith(expect.stringContaining("e.trashed_at IS NULL"));
    expect(response.headers.get("cache-control")).toBe("public, max-age=300");
    await expect(response.text()).resolves.toContain("https://atelier.example/blog/visible-story");
  });
});
