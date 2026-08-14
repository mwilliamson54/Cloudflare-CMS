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
});
