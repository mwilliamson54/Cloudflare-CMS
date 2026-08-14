import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const repository = vi.hoisted(() => ({
  createContentEntry: vi.fn(),
  updateContentEntry: vi.fn(),
  deleteContentEntry: vi.fn(),
  getContentEntry: vi.fn(),
}));

vi.mock("../db", async () => {
  const actual = await vi.importActual<typeof import("../db")>("../db");
  return { ...actual, ...repository };
});

import { cmsRouter } from "./cms";

type CmsRole = "admin" | "editor" | "author" | "contributor" | "subscriber" | "viewer";

function context(role: CmsRole, id: number): TrpcContext {
  return {
    user: { id, openId: `${role}-${id}`, name: role, email: `${role}-${id}@example.com`, loginMethod: "test", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const now = new Date("2026-08-14T00:00:00.000Z");

function entry(authorId: number, id = 33) {
  return {
    id,
    authorId,
    contentTypeId: 1,
    title: "Original title",
    slug: "original-title",
    excerpt: null,
    bodyMarkdown: null,
    bodyHtml: null,
    featuredMediaId: null,
    parentId: null,
    templateKey: "default",
    status: "draft" as const,
    scheduledAt: null,
    publishedAt: null,
    archivedAt: null,
    seoTitle: null,
    seoDescription: null,
    focusKeyword: null,
    canonicalUrl: null,
    robotsIndex: true,
    robotsFollow: true,
    ogTitle: null,
    ogDescription: null,
    ogImageMediaId: null,
    fieldData: null,
    createdAt: now,
    updatedAt: now,
    categories: [],
    tags: [],
  };
}

describe("CMS content lifecycle procedures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repository.getContentEntry.mockResolvedValue(entry(12));
    repository.createContentEntry.mockImplementation(async (input: unknown) => ({ id: 71, ...input }));
    repository.updateContentEntry.mockImplementation(async (id: number, values: unknown) => ({ ...entry(12, id), ...values }));
    repository.deleteContentEntry.mockResolvedValue(true);
  });

  it("creates a draft post under the authenticated author and sanitizes rich HTML", async () => {
    const result = await cmsRouter.createCaller(context("author", 12)).content.create({
      contentTypeKey: "post",
      title: "A considered silhouette",
      slug: "a-considered-silhouette",
      status: "draft",
      bodyHtml: '<p>Safe <strong>markup</strong></p><script>alert("unsafe")</script>',
    });

    expect(repository.createContentEntry).toHaveBeenCalledWith(expect.objectContaining({
      authorId: 12,
      status: "draft",
      bodyHtml: "<p>Safe <strong>markup</strong></p>",
    }));
    expect(result).toMatchObject({ id: 71, authorId: 12, status: "draft" });
  });

  it("routes page and custom-entry drafts through the same authenticated lifecycle contract", async () => {
    const caller = cmsRouter.createCaller(context("author", 12));
    await caller.content.create({ contentTypeKey: "page", title: "Our atelier", slug: "our-atelier", status: "draft", templateKey: "landing" });
    await caller.content.create({ contentTypeKey: "lookbook", title: "Autumn study", slug: "autumn-study", status: "draft", fieldData: { season: "autumn" } });

    expect(repository.createContentEntry).toHaveBeenNthCalledWith(1, expect.objectContaining({ authorId: 12, contentTypeKey: "page", templateKey: "landing" }));
    expect(repository.createContentEntry).toHaveBeenNthCalledWith(2, expect.objectContaining({ authorId: 12, contentTypeKey: "lookbook", fieldData: { season: "autumn" } }));
  });

  it("permits authors to publish but rejects contributors from publishing", async () => {
    await cmsRouter.createCaller(context("author", 12)).content.create({
      contentTypeKey: "post",
      title: "Published by author",
      slug: "published-by-author",
      status: "published",
    });

    await expect(cmsRouter.createCaller(context("contributor", 13)).content.create({
      contentTypeKey: "post",
      title: "Restricted publication",
      slug: "restricted-publication",
      status: "published",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(repository.createContentEntry).toHaveBeenCalledTimes(1);
  });

  it("allows an owner to update and delete their entry while preserving sanitization", async () => {
    const caller = cmsRouter.createCaller(context("author", 12));
    await caller.content.update({ id: 33, values: { title: "Revised title", bodyHtml: '<p>Revised</p><img src="javascript:alert(1)">' } });
    await expect(caller.content.delete({ id: 33 })).resolves.toEqual({ deleted: true });

    expect(repository.updateContentEntry).toHaveBeenCalledWith(33, expect.objectContaining({
      title: "Revised title",
      bodyHtml: "<p>Revised</p><img>",
    }));
    expect(repository.deleteContentEntry).toHaveBeenCalledWith(33);
  });

  it("rejects an author editing or deleting another author's content, while an editor can complete the lifecycle", async () => {
    const author = cmsRouter.createCaller(context("author", 99));
    await expect(author.content.update({ id: 33, values: { title: "Unauthorized revision" } })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(author.content.delete({ id: 33 })).rejects.toMatchObject({ code: "FORBIDDEN" });

    const editor = cmsRouter.createCaller(context("editor", 4));
    await expect(editor.content.update({ id: 33, values: { status: "archived" } })).resolves.toMatchObject({ id: 33, status: "archived" });
    await expect(editor.content.delete({ id: 33 })).resolves.toEqual({ deleted: true });
  });
});
