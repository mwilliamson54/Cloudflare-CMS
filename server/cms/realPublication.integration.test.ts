import express from "express";
import type { Server } from "node:http";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ authenticateRestRequest: vi.fn() }));
vi.mock("./restAuth", () => auth);

import { bootstrapCms, deleteContentEntry } from "../db";
import { registerSeoRoutes } from "./seo";
import { registerWordPressRestRoutes } from "./wpRest";

let server: Server | undefined;
let baseUrl = "";
const createdIds: number[] = [];
const authorId = 900_001;

async function request(path: string, init?: RequestInit) {
  return fetch(`${baseUrl}${path}`, init);
}

describe("real repository REST publication lifecycle", () => {
  beforeAll(async () => { await bootstrapCms(); });

  beforeEach(async () => {
    auth.authenticateRestRequest.mockResolvedValue({ user: { id: authorId, role: "author" }, scopes: ["content:write"] });
    const app = express();
    app.use(express.json());
    registerWordPressRestRoutes(app);
    registerSeoRoutes(app);
    server = await new Promise<Server>(resolve => { const instance = app.listen(0, () => resolve(instance)); });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP test server.");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await Promise.all(createdIds.splice(0).map(id => deleteContentEntry(id)));
    await new Promise<void>(resolve => server?.close(() => resolve()));
    server = undefined;
  });

  it("persists a draft, publishes it through REST, exposes it publicly, and omits a noindex sibling from the sitemap", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const title = `Integration visibility ${suffix}`;
    const slug = `integration-visibility-${suffix}`;
    const draft = await request("/api/wp/v2/posts", { method: "POST", headers: { authorization: "Bearer real-db-token", "content-type": "application/json" }, body: JSON.stringify({ title, slug, status: "draft", content: { raw: "Persistent draft body" } }) });
    expect(draft.status).toBe(201);
    const draftBody = await draft.json() as { id: number };
    createdIds.push(draftBody.id);

    const beforePublication = await request(`/api/wp/v2/posts?search=${encodeURIComponent(title)}`);
    await expect(beforePublication.json()).resolves.toEqual([]);
    const beforeSitemap = await request("/sitemap.xml");
    await expect(beforeSitemap.text()).resolves.not.toContain(`/blog/${slug}`);

    const published = await request(`/api/wp/v2/posts/${draftBody.id}`, { method: "PATCH", headers: { authorization: "Bearer real-db-token", "content-type": "application/json" }, body: JSON.stringify({ status: "published" }) });
    expect(published.status).toBe(200);
    await expect(published.json()).resolves.toMatchObject({ id: draftBody.id, status: "published", slug });

    const visible = await request(`/api/wp/v2/posts?search=${encodeURIComponent(title)}`);
    await expect(visible.json()).resolves.toMatchObject([{ id: draftBody.id, slug, status: "published" }]);
    const visibleSitemap = await request("/sitemap.xml");
    await expect(visibleSitemap.text()).resolves.toContain(`/blog/${slug}`);

    const noindexSlug = `integration-noindex-${suffix}`;
    const noindex = await request("/api/wp/v2/posts", { method: "POST", headers: { authorization: "Bearer real-db-token", "content-type": "application/json" }, body: JSON.stringify({ title: `Integration noindex ${suffix}`, slug: noindexSlug, status: "published", meta: { robots_index: false } }) });
    expect(noindex.status).toBe(201);
    const noindexBody = await noindex.json() as { id: number };
    createdIds.push(noindexBody.id);
    const sitemapAfterNoindex = await request("/sitemap.xml");
    await expect(sitemapAfterNoindex.text()).resolves.not.toContain(`/blog/${noindexSlug}`);

    const pageTitle = `Integration page ${suffix}`;
    const pageSlug = `integration-page-${suffix}`;
    const pageDraft = await request("/api/wp/v2/pages", { method: "POST", headers: { authorization: "Bearer real-db-token", "content-type": "application/json" }, body: JSON.stringify({ title: pageTitle, slug: pageSlug, status: "draft", content: { raw: "Persistent page draft" } }) });
    expect(pageDraft.status).toBe(201);
    const pageDraftBody = await pageDraft.json() as { id: number };
    createdIds.push(pageDraftBody.id);
    const hiddenPages = await request(`/api/wp/v2/pages?search=${encodeURIComponent(pageTitle)}`);
    await expect(hiddenPages.json()).resolves.toEqual([]);

    const pagePublished = await request(`/api/wp/v2/pages/${pageDraftBody.id}`, { method: "PATCH", headers: { authorization: "Bearer real-db-token", "content-type": "application/json" }, body: JSON.stringify({ status: "published" }) });
    expect(pagePublished.status).toBe(200);
    const visiblePages = await request(`/api/wp/v2/pages?search=${encodeURIComponent(pageTitle)}`);
    await expect(visiblePages.json()).resolves.toMatchObject([{ id: pageDraftBody.id, slug: pageSlug, status: "published" }]);
    const pageSitemap = await request("/sitemap.xml");
    await expect(pageSitemap.text()).resolves.toContain(`/${pageSlug}`);
  });
});
