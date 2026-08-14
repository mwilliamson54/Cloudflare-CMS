import { beforeEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({ bootstrapCms: vi.fn(), listContentEntries: vi.fn(), getContentEntryBySlug: vi.fn(), getSettings: vi.fn() }));

vi.mock("../db", async () => ({ ...(await vi.importActual<typeof import("../db")>("../db")), ...repository }));

import { siteRouter } from "./site";

describe("public content lifecycle visibility", () => {
  beforeEach(() => { vi.clearAllMocks(); repository.listContentEntries.mockResolvedValue({ entries: [], total: 0 }); repository.getSettings.mockResolvedValue({ enabledPlugins: [] }); });

  it("queries only published posts and preserves public pagination/search inputs", async () => {
    await siteRouter.createCaller({} as any).posts({ query: "tailoring", page: 2, perPage: 25 });
    expect(repository.listContentEntries).toHaveBeenCalledWith({ contentTypeKey: "post", publishedOnly: true, query: "tailoring", page: 2, perPage: 25 });
  });

  it("queries only published pages and does not surface unavailable post slugs", async () => {
    await siteRouter.createCaller({} as any).pages();
    await expect(siteRouter.createCaller({} as any).post({ slug: "scheduled-story" })).resolves.toBeNull();
    expect(repository.listContentEntries).toHaveBeenCalledWith({ contentTypeKey: "page", publishedOnly: true, perPage: 100 });
    expect(repository.getContentEntryBySlug).toHaveBeenCalledWith("post", "scheduled-story");
  });

  it("uses the published-only page lookup for a public page slug", async () => {
    repository.getContentEntryBySlug.mockResolvedValue(null);

    await expect(siteRouter.createCaller({} as any).page({ slug: "studio" })).resolves.toBeNull();
    expect(repository.getContentEntryBySlug).toHaveBeenCalledWith("page", "studio");
  });

  it("uses the same published-only contract for category archives", async () => {
    repository.listContentEntries.mockResolvedValue({ entries: [{ id: 11, categories: [{ slug: "fashion" }] }], total: 1 });

    await expect(siteRouter.createCaller({} as any).categoryPosts({ slug: "fashion" })).resolves.toEqual([{ id: 11, categories: [{ slug: "fashion" }] }]);
    expect(repository.listContentEntries).toHaveBeenCalledWith({ contentTypeKey: "post", publishedOnly: true, perPage: 100 });
  });

  it("uses the same published-only contract for tag archives", async () => {
    repository.listContentEntries.mockResolvedValue({ entries: [{ id: 12, categories: [], tags: [{ slug: "tailoring" }] }], total: 1 });

    await expect(siteRouter.createCaller({} as any).tagPosts({ slug: "tailoring" })).resolves.toEqual([{ id: 12, categories: [], tags: [{ slug: "tailoring" }] }]);
    expect(repository.listContentEntries).toHaveBeenCalledWith({ contentTypeKey: "post", publishedOnly: true, perPage: 100 });
  });
});
