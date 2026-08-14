import { describe, expect, it, vi } from "vitest";
import { onRequestGet } from "../../functions/api/wp/v2/[[path]]";

function database() {
  const prepare = vi.fn((query: string) => {
    const statement = {
      bind: vi.fn(() => statement),
      first: vi.fn().mockResolvedValue(query.includes("COUNT(*)") ? { total: 2 } : { id: 9, name: "Editorial Author", created_at: "2026-08-14T00:00:00.000Z" }),
      all: vi.fn().mockResolvedValue({ results: [{ id: 9, name: "Editorial Author", email: "private@example.com", role: "author", created_at: "2026-08-14T00:00:00.000Z" }] }),
    };
    return statement;
  });
  return { prepare };
}

describe("Cloudflare Pages WordPress users resource", () => {
  it("returns paginated public identities without email or role fields", async () => {
    const response = await onRequestGet({ request: new Request("https://atelier.example/api/wp/v2/users?page=1&per_page=1"), params: { path: ["users"] }, env: { CMS_DB: database(), CMS_MEDIA: {}, CMS_JWT_SECRET: "test" } } as any);

    expect(response.headers.get("X-WP-Total")).toBe("2");
    expect(response.headers.get("X-WP-TotalPages")).toBe("2");
    await expect(response.json()).resolves.toEqual([{ id: 9, name: "Editorial Author", slug: "author-9", link: "/author/9", description: "", avatar_urls: {}, registered_date: "2026-08-14T00:00:00.000Z" }]);
  });

  it("returns one public identity at the individual user path", async () => {
    const response = await onRequestGet({ request: new Request("https://atelier.example/api/wp/v2/users/9"), params: { path: ["users", "9"] }, env: { CMS_DB: database(), CMS_MEDIA: {}, CMS_JWT_SECRET: "test" } } as any);

    await expect(response.json()).resolves.toEqual({ id: 9, name: "Editorial Author", slug: "author-9", link: "/author/9", description: "", avatar_urls: {}, registered_date: "2026-08-14T00:00:00.000Z" });
  });
});
