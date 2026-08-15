import express from "express";
import type { Server } from "node:http";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ authenticateRestRequest: vi.fn() }));
vi.mock("./restAuth", () => auth);

import { bootstrapCms, createCategory, createTag, deleteCategory, deleteContentEntry, deleteTag } from "../db";
import { siteRouter } from "../routers/site";
import { registerSeoRoutes } from "./seo";
import { registerWordPressRestRoutes } from "./wpRest";

let server: Server | undefined;
let baseUrl = "";
const createdIds: number[] = [];
const createdCategoryIds: number[] = [];
const createdTagIds: number[] = [];
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
    await Promise.all(createdCategoryIds.splice(0).map(id => deleteCategory(id)));
    await Promise.all(createdTagIds.splice(0).map(id => deleteTag(id)));
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

  it("supports real post and page read, update, archive, trash, and permanent deletion semantics", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const post = await request("/api/wp/v2/posts", { method: "POST", headers: { authorization: "Bearer real-db-token", "content-type": "application/json" }, body: JSON.stringify({ title: `Lifecycle post ${suffix}`, slug: `lifecycle-post-${suffix}`, status: "published", content: { raw: "Initial post copy" } }) });
    const postBody = await post.json() as { id: number };
    createdIds.push(postBody.id);
    await expect((await request(`/api/wp/v2/posts/${postBody.id}`)).json()).resolves.toMatchObject({ id: postBody.id, content: { raw: "Initial post copy" } });
    await expect((await request(`/api/wp/v2/posts/${postBody.id}`, { method: "PATCH", headers: { authorization: "Bearer real-db-token", "content-type": "application/json" }, body: JSON.stringify({ content: { raw: "Revised post copy" }, status: "archived" }) })).json()).resolves.toMatchObject({ id: postBody.id, status: "archived" });
    expect((await request(`/api/wp/v2/posts/${postBody.id}`)).status).toBe(404);
    expect((await request(`/api/wp/v2/posts/${postBody.id}`, { method: "DELETE", headers: { authorization: "Bearer real-db-token" } })).status).toBe(200);
    expect((await request(`/api/wp/v2/posts/${postBody.id}?force=true`, { method: "DELETE", headers: { authorization: "Bearer real-db-token" } })).status).toBe(200);
    createdIds.splice(createdIds.indexOf(postBody.id), 1);

    const page = await request("/api/wp/v2/pages", { method: "POST", headers: { authorization: "Bearer real-db-token", "content-type": "application/json" }, body: JSON.stringify({ title: `Lifecycle page ${suffix}`, slug: `lifecycle-page-${suffix}`, status: "published", content: { raw: "Initial page copy" } }) });
    const pageBody = await page.json() as { id: number };
    createdIds.push(pageBody.id);
    await expect((await request(`/api/wp/v2/pages/${pageBody.id}`, { method: "PATCH", headers: { authorization: "Bearer real-db-token", "content-type": "application/json" }, body: JSON.stringify({ title: { raw: `Updated lifecycle page ${suffix}` } }) })).json()).resolves.toMatchObject({ id: pageBody.id, title: { rendered: `Updated lifecycle page ${suffix}` } });
    await expect((await request(`/api/wp/v2/pages/${pageBody.id}`)).json()).resolves.toMatchObject({ id: pageBody.id, title: { rendered: `Updated lifecycle page ${suffix}` } });
    expect((await request(`/api/wp/v2/pages/${pageBody.id}`, { method: "PATCH", headers: { authorization: "Bearer real-db-token", "content-type": "application/json" }, body: JSON.stringify({ status: "archived" }) })).status).toBe(200);
    expect((await request(`/api/wp/v2/pages/${pageBody.id}`)).status).toBe(404);
    await expect((await request(`/api/wp/v2/pages?search=${encodeURIComponent(`Updated lifecycle page ${suffix}`)}`)).json()).resolves.toEqual([]);
    await expect((await request("/sitemap.xml")).text()).resolves.not.toContain(`lifecycle-page-${suffix}`);
    expect((await request(`/api/wp/v2/pages/${pageBody.id}?force=true`, { method: "DELETE", headers: { authorization: "Bearer real-db-token" } })).status).toBe(200);
    createdIds.splice(createdIds.indexOf(pageBody.id), 1);
  });

  it.each(["posts", "pages"] as const)("keeps a scheduled %s out of public reads and the sitemap until publication", async resource => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const title = `Scheduled ${resource} ${suffix}`;
    const slug = `scheduled-${resource}-${suffix}`;
    const scheduled = await request(`/api/wp/v2/${resource}`, { method: "POST", headers: { authorization: "Bearer real-db-token", "content-type": "application/json" }, body: JSON.stringify({ title, slug, status: "scheduled", date: new Date(Date.now() + 60_000).toISOString(), content: { raw: "Scheduled editorial copy" } }) });
    expect(scheduled.status).toBe(201);
    const body = await scheduled.json() as { id: number };
    createdIds.push(body.id);

    await expect((await request(`/api/wp/v2/${resource}?search=${encodeURIComponent(title)}`)).json()).resolves.toEqual([]);
    expect((await request(`/api/wp/v2/${resource}/${body.id}`)).status).toBe(404);
    await expect((await request("/sitemap.xml")).text()).resolves.not.toContain(slug);

    expect((await request(`/api/wp/v2/${resource}/${body.id}`, { method: "PATCH", headers: { authorization: "Bearer real-db-token", "content-type": "application/json" }, body: JSON.stringify({ status: "published" }) })).status).toBe(200);
    await expect((await request(`/api/wp/v2/${resource}?search=${encodeURIComponent(title)}`)).json()).resolves.toMatchObject([{ id: body.id, slug, status: "published" }]);
    await expect((await request("/sitemap.xml")).text()).resolves.toContain(resource === "posts" ? `/blog/${slug}` : `/${slug}`);
  });

  it("updates homepage/archive, category, tag, search, and sitemap readers across archive, trash, and restore transitions", async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const title = `Surface lifecycle ${suffix}`;
    const slug = `surface-lifecycle-${suffix}`;
    const category = await createCategory({ name: `Surface category ${suffix}`, slug: `surface-category-${suffix}` });
    const tag = await createTag({ name: `Surface tag ${suffix}`, slug: `surface-tag-${suffix}` });
    createdCategoryIds.push(category.id);
    createdTagIds.push(tag.id);
    const created = await request("/api/wp/v2/posts", { method: "POST", headers: { authorization: "Bearer real-db-token", "content-type": "application/json" }, body: JSON.stringify({ title, slug, status: "published", content: { raw: "Lifecycle surface proof" }, categories: [category.id], tags: [tag.id] }) });
    expect(created.status).toBe(201);
    const post = await created.json() as { id: number };
    createdIds.push(post.id);
    const site = siteRouter.createCaller({} as any);
    const expectVisibleEverywhere = async () => {
      await expect(site.posts()).resolves.toMatchObject({ entries: expect.arrayContaining([expect.objectContaining({ id: post.id, slug })]) });
      await expect(site.posts({ query: title })).resolves.toMatchObject({ entries: [expect.objectContaining({ id: post.id, slug })] });
      await expect(site.categoryPosts({ slug: category.slug })).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ id: post.id, slug })]));
      await expect(site.tagPosts({ slug: tag.slug })).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ id: post.id, slug })]));
      await expect((await request("/sitemap.xml")).text()).resolves.toContain(`/blog/${slug}`);
    };
    const expectHiddenEverywhere = async () => {
      await expect(site.posts({ query: title })).resolves.toMatchObject({ entries: [] });
      await expect(site.categoryPosts({ slug: category.slug })).resolves.not.toEqual(expect.arrayContaining([expect.objectContaining({ id: post.id })]));
      await expect(site.tagPosts({ slug: tag.slug })).resolves.not.toEqual(expect.arrayContaining([expect.objectContaining({ id: post.id })]));
      await expect((await request("/sitemap.xml")).text()).resolves.not.toContain(`/blog/${slug}`);
    };

    await expectVisibleEverywhere();
    expect((await request(`/api/wp/v2/posts/${post.id}`, { method: "PATCH", headers: { authorization: "Bearer real-db-token", "content-type": "application/json" }, body: JSON.stringify({ status: "archived" }) })).status).toBe(200);
    await expectHiddenEverywhere();
    expect((await request(`/api/wp/v2/posts/${post.id}`, { method: "PATCH", headers: { authorization: "Bearer real-db-token", "content-type": "application/json" }, body: JSON.stringify({ status: "published" }) })).status).toBe(200);
    await expectVisibleEverywhere();
    expect((await request(`/api/wp/v2/posts/${post.id}`, { method: "DELETE", headers: { authorization: "Bearer real-db-token" } })).status).toBe(200);
    await expectHiddenEverywhere();
    expect((await request(`/api/wp/v2/posts/${post.id}?restore=true`, { method: "PATCH", headers: { authorization: "Bearer real-db-token", "content-type": "application/json" }, body: JSON.stringify({}) })).status).toBe(200);
    await expectVisibleEverywhere();
  });
});
