import express from "express";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
  getSettings: vi.fn(),
  listContentEntries: vi.fn(),
}));

vi.mock("../db", () => repository);

import { registerSeoRoutes } from "./seo";

let server: Server | undefined;

async function request(path: string) {
  const app = express();
  registerSeoRoutes(app);
  server = await new Promise<Server>(resolve => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected a TCP test server.");
  return fetch(`http://127.0.0.1:${address.port}${path}`);
}

describe("local sitemap visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repository.getSettings.mockResolvedValue({ siteIndexing: true });
    repository.listContentEntries.mockImplementation(async ({ contentTypeKey }: { contentTypeKey: string }) => ({
      entries: contentTypeKey === "post"
        ? [
            { slug: "indexed-story", robotsIndex: true, updatedAt: new Date("2026-08-14T00:00:00.000Z") },
            { slug: "private-story", robotsIndex: false, updatedAt: new Date("2026-08-13T00:00:00.000Z") },
          ]
        : [{ slug: "about", robotsIndex: true, updatedAt: new Date("2026-08-12T00:00:00.000Z") }],
      total: 1,
    }));
  });

  afterEach(async () => {
    await new Promise<void>(resolve => server?.close(() => resolve()));
    server = undefined;
  });

  it("includes only published collection results that opt into indexing", async () => {
    const response = await request("/sitemap.xml");
    const xml = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=300");
    expect(xml).toContain("/blog/indexed-story");
    expect(xml).toContain("/about");
    expect(xml).not.toContain("private-story");
    expect(repository.listContentEntries).toHaveBeenCalledWith(expect.objectContaining({ contentTypeKey: "post", publishedOnly: true }));
    expect(repository.listContentEntries).toHaveBeenCalledWith(expect.objectContaining({ contentTypeKey: "page", publishedOnly: true }));
  });

  it("keeps noindex public content out of the sitemap while retaining indexed publication URLs", async () => {
    const response = await request("/sitemap.xml");
    const xml = await response.text();

    expect(xml).toContain("/blog/indexed-story");
    expect(xml).not.toContain("/blog/private-story");
    expect(response.headers.get("content-type")).toContain("application/xml");
  });

  it("returns an empty sitemap and avoids content queries when site-wide indexing is disabled", async () => {
    repository.getSettings.mockResolvedValue({ siteIndexing: false });
    const response = await request("/sitemap.xml");
    const xml = await response.text();

    expect(response.status).toBe(200);
    expect(xml).toContain("<urlset");
    expect(xml).not.toContain("<url><loc>");
    expect(repository.listContentEntries).not.toHaveBeenCalled();
  });
});
