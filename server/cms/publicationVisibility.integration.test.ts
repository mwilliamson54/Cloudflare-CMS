import express from "express";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ entries: [] as any[], nextId: 1 }));
const repository = vi.hoisted(() => ({
  createContentEntry: vi.fn(),
  getContentEntry: vi.fn(),
  getSettings: vi.fn(),
  listContentEntries: vi.fn(),
  updateContentEntry: vi.fn(),
}));
const auth = vi.hoisted(() => ({ authenticateRestRequest: vi.fn() }));

vi.mock("../db", async () => ({ ...(await vi.importActual<typeof import("../db")>("../db")), ...repository }));
vi.mock("./restAuth", () => auth);

import { registerSeoRoutes } from "./seo";
import { registerWordPressRestRoutes } from "./wpRest";

let server: Server | undefined;

async function request(path: string, init?: RequestInit) {
  const app = express();
  app.use(express.json());
  registerWordPressRestRoutes(app);
  registerSeoRoutes(app);
  server = await new Promise<Server>(resolve => { const instance = app.listen(0, () => resolve(instance)); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected TCP test server.");
  return fetch(`http://127.0.0.1:${address.port}${path}`, init);
}

describe("REST publication visibility lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.entries = [];
    state.nextId = 1;
    repository.getSettings.mockResolvedValue({ siteIndexing: true });
    repository.createContentEntry.mockImplementation(async (input: any) => {
      const now = new Date("2026-08-14T12:00:00.000Z");
      const entry = { id: state.nextId++, contentTypeId: input.contentTypeKey === "post" ? 1 : 2, authorId: input.authorId, title: input.title, slug: input.slug, excerpt: input.excerpt ?? null, bodyMarkdown: input.bodyMarkdown ?? null, bodyHtml: null, featuredMediaId: null, parentId: null, templateKey: "default", status: input.status, scheduledAt: null, publishedAt: input.status === "published" ? now : null, archivedAt: null, trashedAt: null, seoTitle: input.seoTitle ?? null, seoDescription: input.seoDescription ?? null, focusKeyword: null, canonicalUrl: input.canonicalUrl ?? null, robotsIndex: input.robotsIndex ?? true, robotsFollow: input.robotsFollow ?? true, ogTitle: null, ogDescription: null, ogImageMediaId: null, fieldData: null, createdAt: now, updatedAt: now, categories: [], tags: [], contentTypeKey: input.contentTypeKey };
      state.entries.push(entry);
      return entry;
    });
    repository.getContentEntry.mockImplementation(async (id: number) => state.entries.find(entry => entry.id === id) ?? null);
    repository.updateContentEntry.mockImplementation(async (id: number, values: any) => {
      const entry = state.entries.find(candidate => candidate.id === id);
      if (!entry) return null;
      Object.assign(entry, Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)), { publishedAt: values.status === "published" ? new Date("2026-08-14T12:05:00.000Z") : entry.publishedAt, updatedAt: new Date("2026-08-14T12:05:00.000Z") });
      return entry;
    });
    repository.listContentEntries.mockImplementation(async (options: any) => {
      const matching = state.entries.filter(entry => entry.contentTypeKey === options.contentTypeKey && (!options.publishedOnly || entry.status === "published") && !entry.trashedAt && (!options.query || entry.title.includes(options.query)));
      return { entries: matching, total: matching.length };
    });
    auth.authenticateRestRequest.mockResolvedValue({ user: { id: 22, role: "author" }, scopes: ["content:write"] });
  });

  afterEach(async () => { await new Promise<void>(resolve => server?.close(() => resolve())); server = undefined; });

  it("publishes through REST, makes published content public, and keeps a noindex publication out of the sitemap", async () => {
    const published = await request("/api/wp/v2/posts", { method: "POST", headers: { authorization: "Bearer lifecycle-token", "content-type": "application/json" }, body: JSON.stringify({ title: "Visible tailoring", slug: "visible-tailoring", status: "published", content: { raw: "Published body" } }) });
    expect(published.status).toBe(201);

    const noindex = await request("/api/wp/v2/posts", { method: "POST", headers: { authorization: "Bearer lifecycle-token", "content-type": "application/json" }, body: JSON.stringify({ title: "Private editorial", slug: "private-editorial", status: "published", meta: { robots_index: false }, content: { raw: "Noindex body" } }) });
    expect(noindex.status).toBe(201);

    const publicPosts = await request("/api/wp/v2/posts");
    await expect(publicPosts.json()).resolves.toMatchObject([{ slug: "visible-tailoring", status: "published" }, { slug: "private-editorial", status: "published" }]);

    const sitemap = await request("/sitemap.xml");
    const xml = await sitemap.text();
    expect(sitemap.headers.get("content-type")).toContain("application/xml");
    expect(xml).toContain("/blog/visible-tailoring");
    expect(xml).not.toContain("/blog/private-editorial");
  });

  it("keeps a draft out of public surfaces until a REST publication update promotes it", async () => {
    const draft = await request("/api/wp/v2/posts", { method: "POST", headers: { authorization: "Bearer lifecycle-token", "content-type": "application/json" }, body: JSON.stringify({ title: "Draft to publish", slug: "draft-to-publish", status: "draft", content: { raw: "Draft body" } }) });
    expect(draft.status).toBe(201);
    const draftBody = await draft.json() as { id: number };

    const beforePublication = await request("/api/wp/v2/posts");
    await expect(beforePublication.json()).resolves.toEqual([]);
    const beforeSitemap = await request("/sitemap.xml");
    await expect(beforeSitemap.text()).resolves.not.toContain("/blog/draft-to-publish");

    const published = await request(`/api/wp/v2/posts/${draftBody.id}`, { method: "PATCH", headers: { authorization: "Bearer lifecycle-token", "content-type": "application/json" }, body: JSON.stringify({ status: "published" }) });
    expect(published.status).toBe(200);
    await expect(published.json()).resolves.toMatchObject({ id: draftBody.id, status: "published" });

    const afterPublication = await request("/api/wp/v2/posts");
    await expect(afterPublication.json()).resolves.toMatchObject([{ slug: "draft-to-publish", status: "published" }]);
    const afterSitemap = await request("/sitemap.xml");
    await expect(afterSitemap.text()).resolves.toContain("/blog/draft-to-publish");
  });

  it("keeps scheduled and archived REST content out of public collections and the sitemap", async () => {
    const scheduled = await request("/api/wp/v2/posts", { method: "POST", headers: { authorization: "Bearer lifecycle-token", "content-type": "application/json" }, body: JSON.stringify({ title: "Scheduled study", slug: "scheduled-study", status: "scheduled", date: "2026-09-01T09:00:00.000Z" }) });
    const archived = await request("/api/wp/v2/posts", { method: "POST", headers: { authorization: "Bearer lifecycle-token", "content-type": "application/json" }, body: JSON.stringify({ title: "Archived study", slug: "archived-study", status: "archived" }) });
    expect(scheduled.status).toBe(201);
    expect(archived.status).toBe(201);

    const publicPosts = await request("/api/wp/v2/posts");
    await expect(publicPosts.json()).resolves.toEqual([]);
    const sitemap = await request("/sitemap.xml");
    const xml = await sitemap.text();
    expect(xml).not.toContain("/blog/scheduled-study");
    expect(xml).not.toContain("/blog/archived-study");
  });
});
