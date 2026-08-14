import express from "express";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({ listContentEntries: vi.fn(), getContentEntry: vi.fn(), getContentEntryBySlug: vi.fn(), createContentEntry: vi.fn(), updateContentEntry: vi.fn(), deleteContentEntry: vi.fn() }));
const auth = vi.hoisted(() => ({ authenticateRestRequest: vi.fn() }));

vi.mock("../db", async () => ({ ...(await vi.importActual<typeof import("../db")>("../db")), ...repository }));
vi.mock("./restAuth", () => auth);

import { registerWordPressRestRoutes } from "./wpRest";

let server: Server | undefined;
const published = { id: 5, contentTypeId: 1, authorId: 9, title: "Published", slug: "published", excerpt: "A story", bodyMarkdown: "# Heading", bodyHtml: null, featuredMediaId: null, parentId: null, templateKey: "default", status: "published" as const, scheduledAt: null, publishedAt: new Date("2026-08-14T00:00:00.000Z"), archivedAt: null, seoTitle: null, seoDescription: null, focusKeyword: null, canonicalUrl: null, robotsIndex: true, robotsFollow: true, ogTitle: null, ogDescription: null, ogImageMediaId: null, fieldData: null, createdAt: new Date("2026-08-13T00:00:00.000Z"), updatedAt: new Date("2026-08-14T00:00:00.000Z"), categories: [], tags: [] };

async function request(path: string, init?: RequestInit) {
  const app = express(); app.use(express.json()); registerWordPressRestRoutes(app);
  server = await new Promise<Server>(resolve => { const instance = app.listen(0, () => resolve(instance)); });
  const address = server.address(); if (!address || typeof address === "string") throw new Error("Expected TCP test server.");
  return fetch(`http://127.0.0.1:${address.port}${path}`, init);
}

describe("WordPress REST adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repository.listContentEntries.mockResolvedValue({ entries: [published], total: 23 });
    repository.getContentEntry.mockResolvedValue(published); repository.getContentEntryBySlug.mockResolvedValue(published);
    repository.createContentEntry.mockImplementation(async (input: unknown) => ({ ...published, ...(input as object) }));
    repository.updateContentEntry.mockResolvedValue(published); repository.deleteContentEntry.mockResolvedValue(true);
    auth.authenticateRestRequest.mockResolvedValue({ user: { id: 9, role: "author" }, scopes: ["content:write"] });
  });
  afterEach(async () => { await new Promise<void>(resolve => server?.close(() => resolve())); server = undefined; });

  it("returns only published post collections with WordPress pagination headers and search input", async () => {
    const response = await request("/api/wp/v2/posts?search=tailoring&page=2&per_page=10");
    expect(response.status).toBe(200); expect(response.headers.get("x-wp-total")).toBe("23"); expect(response.headers.get("x-wp-totalpages")).toBe("3");
    expect(repository.listContentEntries).toHaveBeenCalledWith({ contentTypeKey: "post", publishedOnly: true, query: "tailoring", page: 2, perPage: 10 });
    await expect(response.json()).resolves.toMatchObject([{ id: 5, status: "published", title: { rendered: "Published" } }]);
  });

  it("returns published page collections through the page content-type contract", async () => {
    const response = await request("/api/wp/v2/pages?search=studio&page=3&per_page=5");

    expect(response.status).toBe(200);
    expect(repository.listContentEntries).toHaveBeenCalledWith({ contentTypeKey: "page", publishedOnly: true, query: "studio", page: 3, perPage: 5 });
    expect(response.headers.get("x-wp-total")).toBe("23");
  });

  it.each(["draft", "scheduled", "archived"] as const)("does not expose an individual %s entry", async status => {
    repository.getContentEntry.mockResolvedValue({ ...published, status });
    const response = await request("/api/wp/v2/posts/5");
    expect(response.status).toBe(404); await expect(response.json()).resolves.toMatchObject({ code: "rest_post_invalid_id", data: { status: 404 } });
  });

  it("creates an authenticated published post using the JWT subject as author", async () => {
    const response = await request("/api/wp/v2/posts", { method: "POST", headers: { authorization: "Bearer test", "content-type": "application/json" }, body: JSON.stringify({ title: { raw: "A new story" }, slug: "a-new-story", content: { raw: "Body" }, status: "published" }) });
    expect(response.status).toBe(201); expect(auth.authenticateRestRequest).toHaveBeenCalledWith("Bearer test", "content:write");
    expect(repository.createContentEntry).toHaveBeenCalledWith(expect.objectContaining({ contentTypeKey: "post", authorId: 9, title: "A new story", status: "published" }));
  });

  it("rejects an author attempting to update another author’s post", async () => {
    repository.getContentEntry.mockResolvedValue({ ...published, authorId: 44 });
    const response = await request("/api/wp/v2/posts/5", { method: "PATCH", headers: { authorization: "Bearer test", "content-type": "application/json" }, body: JSON.stringify({ title: { raw: "Unauthorized" } }) });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: "cms_forbidden", data: { status: 403 } });
    expect(repository.updateContentEntry).not.toHaveBeenCalled();
  });

  it("permanently deletes an owned entry and returns the WordPress deletion envelope", async () => {
    const response = await request("/api/wp/v2/posts/5", { method: "DELETE", headers: { authorization: "Bearer test" } });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ deleted: true, previous: { id: 5, status: "published" } });
    expect(repository.deleteContentEntry).toHaveBeenCalledWith(5);
  });
});
