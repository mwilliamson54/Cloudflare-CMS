import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const repository = vi.hoisted(() => ({
  bootstrapCms: vi.fn(),
  createCategory: vi.fn(),
  createApiTokenRecord: vi.fn(),
  createContentEntry: vi.fn(),
  createCustomContentType: vi.fn(),
  createTag: vi.fn(),
  deleteCategory: vi.fn(),
  deleteContentEntry: vi.fn(),
  deleteMediaRecord: vi.fn(),
  deleteTag: vi.fn(),
  getContentEntry: vi.fn(),
  getMediaRecord: vi.fn(),
  getUserById: vi.fn(),
  listApiTokensForUser: vi.fn(),
  restoreContentEntry: vi.fn(),
  revokeApiToken: vi.fn(),
  setBundledPluginActivation: vi.fn(),
  setSettings: vi.fn(),
  trashContentEntry: vi.fn(),
  updateCategory: vi.fn(),
  updateContentEntry: vi.fn(),
  updateMediaRecord: vi.fn(),
  updateTag: vi.fn(),
  updateUserRole: vi.fn(),
  upsertMenu: vi.fn(),
}));
const mediaService = vi.hoisted(() => ({ persistMediaReplacement: vi.fn(), persistMediaUpload: vi.fn() }));
const tokenService = vi.hoisted(() => ({ issueApiToken: vi.fn(), sha256: vi.fn() }));

vi.mock("../db", async () => ({ ...(await vi.importActual<typeof import("../db")>("../db")), ...repository }));
vi.mock("../cms/media", async () => ({ ...(await vi.importActual<typeof import("../cms/media")>("../cms/media")), ...mediaService }));
vi.mock("../cms/apiTokens", async () => ({ ...(await vi.importActual<typeof import("../cms/apiTokens")>("../cms/apiTokens")), ...tokenService }));

import { cmsRouter } from "./cms";

type CmsRole = "admin" | "editor" | "author" | "contributor" | "subscriber" | "viewer";
function context(role: CmsRole, id = 21): TrpcContext {
  return { user: { id, openId: `${role}-${id}`, name: role, email: `${role}@example.com`, loginMethod: "test", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() }, req: {} as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("CMS procedure capability matrix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const entry = { id: 10, authorId: 21, contentTypeId: 1, title: "Owned", slug: "owned", excerpt: null, bodyMarkdown: null, bodyHtml: null, featuredMediaId: null, parentId: null, templateKey: "default", status: "draft", scheduledAt: null, publishedAt: null, archivedAt: null, trashedAt: null, seoTitle: null, seoDescription: null, focusKeyword: null, canonicalUrl: null, robotsIndex: true, robotsFollow: true, ogTitle: null, ogDescription: null, ogImageMediaId: null, fieldData: null, createdAt: new Date(), updatedAt: new Date(), categories: [], tags: [] };
    repository.bootstrapCms.mockResolvedValue(undefined);
    repository.createApiTokenRecord.mockResolvedValue({ id: 6, tokenId: "token-id" });
    repository.createContentEntry.mockResolvedValue(entry);
    repository.createCustomContentType.mockResolvedValue({ id: 1, key: "lookbook" });
    repository.createCategory.mockResolvedValue({ id: 2, slug: "fashion" });
    repository.createTag.mockResolvedValue({ id: 3, slug: "tailoring" });
    repository.deleteCategory.mockResolvedValue(undefined);
    repository.deleteContentEntry.mockResolvedValue(true);
    repository.deleteMediaRecord.mockResolvedValue(undefined);
    repository.deleteTag.mockResolvedValue(undefined);
    repository.getContentEntry.mockResolvedValue(entry);
    repository.getMediaRecord.mockResolvedValue({ id: 5, uploadedById: 21, fileName: "look.jpg" });
    repository.getUserById.mockResolvedValue({ id: 22, role: "author" });
    repository.upsertMenu.mockResolvedValue({ id: 4, location: "header" });
    repository.listApiTokensForUser.mockResolvedValue([]);
    repository.restoreContentEntry.mockResolvedValue(entry);
    repository.revokeApiToken.mockResolvedValue(undefined);
    repository.setBundledPluginActivation.mockResolvedValue([]);
    repository.setSettings.mockResolvedValue({});
    repository.trashContentEntry.mockResolvedValue(entry);
    repository.updateCategory.mockResolvedValue({ id: 2, slug: "fashion" });
    repository.updateContentEntry.mockResolvedValue(entry);
    repository.updateMediaRecord.mockResolvedValue({ id: 5 });
    repository.updateTag.mockResolvedValue({ id: 3, slug: "tailoring" });
    repository.updateUserRole.mockResolvedValue({ id: 22, role: "editor" });
    mediaService.persistMediaUpload.mockResolvedValue({ id: 5, fileName: "look.jpg" });
    mediaService.persistMediaReplacement.mockResolvedValue({ id: 5, fileName: "replacement.jpg" });
    tokenService.issueApiToken.mockResolvedValue("header.payload.signature");
    tokenService.sha256.mockResolvedValue("hashed-token");
  });

  it("allows an administrator to run site-level bootstrap, content-type, and menu mutations", async () => {
    const caller = cmsRouter.createCaller(context("admin"));
    await expect(caller.bootstrap()).resolves.toEqual({ success: true });
    await expect(caller.contentTypes.create({ key: "lookbook", label: "Lookbook", fieldDefinitions: [] })).resolves.toMatchObject({ key: "lookbook" });
    await expect(caller.menus.save({ name: "Primary", location: "header", items: [{ id: "home", label: "Home", target: "url", url: "/" }] })).resolves.toMatchObject({ location: "header" });
    expect(repository.bootstrapCms).toHaveBeenCalledTimes(1);
    expect(repository.createCustomContentType).toHaveBeenCalledTimes(1);
    expect(repository.upsertMenu).toHaveBeenCalledTimes(1);
  });

  it("allows editors to administer taxonomies but denies them site-level mutations", async () => {
    const caller = cmsRouter.createCaller(context("editor"));
    await expect(caller.categories.create({ name: "Fashion", slug: "fashion" })).resolves.toMatchObject({ slug: "fashion" });
    await expect(caller.tags.create({ name: "Tailoring", slug: "tailoring" })).resolves.toMatchObject({ slug: "tailoring" });
    await expect(caller.menus.save({ name: "Restricted", location: "header", items: [{ id: "home", label: "Home", target: "url", url: "/" }] })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows authors to inspect their tokens but denies taxonomy administration", async () => {
    const caller = cmsRouter.createCaller(context("author", 31));
    await expect(caller.apiTokens.list()).resolves.toEqual([]);
    await expect(caller.categories.create({ name: "Restricted", slug: "restricted" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows contributors to upload media while keeping publication-adjacent administration unavailable", async () => {
    const caller = cmsRouter.createCaller(context("contributor", 41));
    await expect(caller.media.upload({ fileName: "look.jpg", mimeType: "image/jpeg", dataBase64: "ZmFrZQ==" })).resolves.toMatchObject({ id: 5 });
    expect(mediaService.persistMediaUpload).toHaveBeenCalledWith(expect.objectContaining({ uploadedById: 41 }));
    await expect(caller.apiTokens.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.tags.create({ name: "Restricted", slug: "restricted" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows editors to complete their permitted token, taxonomy, and cross-owner media mutation paths", async () => {
    const caller = cmsRouter.createCaller(context("editor", 51));
    await caller.categories.update({ id: 2, values: { name: "Fashion", slug: "fashion" } });
    await caller.categories.delete({ id: 2 });
    await caller.tags.update({ id: 3, values: { name: "Tailoring", slug: "tailoring" } });
    await caller.tags.delete({ id: 3 });
    await caller.apiTokens.create({ name: "Editor token", scopes: ["content:read"], expiresInDays: 30 });
    await caller.apiTokens.revoke({ id: 6 });
    await caller.media.replace({ id: 5, fileName: "editor.jpg", mimeType: "image/jpeg", dataBase64: "ZmFrZQ==" });
    await caller.media.update({ id: 5, values: { altText: "Editor metadata" } });
    await caller.media.delete({ id: 5 });

    expect(repository.updateCategory).toHaveBeenCalledWith(2, expect.any(Object));
    expect(repository.revokeApiToken).toHaveBeenCalledWith(6, 51);
    expect(mediaService.persistMediaReplacement).toHaveBeenCalledWith(expect.objectContaining({ uploadedById: 51 }));
  });

  it("allows authors to create and revoke their own API tokens", async () => {
    const caller = cmsRouter.createCaller(context("author", 61));
    await expect(caller.apiTokens.create({ name: "Author token", scopes: ["content:read"], expiresInDays: 30 })).resolves.toMatchObject({ token: "header.payload.signature" });
    await expect(caller.apiTokens.revoke({ id: 6 })).resolves.toEqual({ success: true });
    expect(repository.createApiTokenRecord).toHaveBeenCalledWith(expect.objectContaining({ userId: 61, tokenHash: "hashed-token" }));
    expect(repository.revokeApiToken).toHaveBeenCalledWith(6, 61);
  });

  it("allows contributors to complete the lifecycle only for their own draft content", async () => {
    const contributor = context("contributor", 71);
    repository.getContentEntry.mockResolvedValue({ id: 10, authorId: 71, contentTypeId: 1, title: "Owned", slug: "owned", excerpt: null, bodyMarkdown: null, bodyHtml: null, featuredMediaId: null, parentId: null, templateKey: "default", status: "draft", scheduledAt: null, publishedAt: null, archivedAt: null, trashedAt: null, seoTitle: null, seoDescription: null, focusKeyword: null, canonicalUrl: null, robotsIndex: true, robotsFollow: true, ogTitle: null, ogDescription: null, ogImageMediaId: null, fieldData: null, createdAt: new Date(), updatedAt: new Date(), categories: [], tags: [] });
    const caller = cmsRouter.createCaller(contributor);
    await caller.content.create({ contentTypeKey: "post", title: "Draft", slug: "draft", status: "draft" });
    await caller.content.update({ id: 10, values: { title: "Revised draft" } });
    await caller.content.trash({ id: 10 });
    await caller.content.restore({ id: 10 });
    await caller.content.delete({ id: 10 });
    await expect(caller.content.update({ id: 10, values: { status: "published" } })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(repository.createContentEntry).toHaveBeenCalledWith(expect.objectContaining({ authorId: 71, status: "draft" }));
  });

  it("allows contributors to replace, update, and delete only their own media", async () => {
    repository.getMediaRecord.mockResolvedValue({ id: 5, uploadedById: 81, fileName: "owned.jpg" });
    const caller = cmsRouter.createCaller(context("contributor", 81));
    await caller.media.replace({ id: 5, fileName: "replacement.jpg", mimeType: "image/jpeg", dataBase64: "ZmFrZQ==" });
    await caller.media.update({ id: 5, values: { altText: "Owned media" } });
    await caller.media.delete({ id: 5 });
    expect(mediaService.persistMediaReplacement).toHaveBeenCalledWith(expect.objectContaining({ uploadedById: 81 }));
    expect(repository.updateMediaRecord).toHaveBeenCalledWith(5, { altText: "Owned media" });
    expect(repository.deleteMediaRecord).toHaveBeenCalledWith(5);
  });

  it("executes every CMS mutation procedure for an administrator", async () => {
    const caller = cmsRouter.createCaller(context("admin"));
    const content = { contentTypeKey: "post", title: "Owned", slug: "owned", status: "draft" as const };
    const media = { fileName: "look.jpg", mimeType: "image/jpeg", dataBase64: "ZmFrZQ==" };
    const settings = { siteTitle: "Atelier", siteDescription: "Journal", siteIndexing: true, homepageCategorySlugs: ["fashion"], footerTagline: "Considered", footerLocation: "London", footerInstagramUrl: "https://www.instagram.com/atelier" };

    await caller.bootstrap();
    await caller.contentTypes.create({ key: "lookbook", label: "Lookbook", fieldDefinitions: [] });
    await caller.content.create(content);
    await caller.content.update({ id: 10, values: { title: "Revised" } });
    await caller.content.trash({ id: 10 });
    await caller.content.restore({ id: 10 });
    await caller.content.delete({ id: 10 });
    await caller.users.updateRole({ id: 22, role: "editor" });
    await caller.categories.create({ name: "Fashion", slug: "fashion" });
    await caller.categories.update({ id: 2, values: { name: "Fashion", slug: "fashion" } });
    await caller.categories.delete({ id: 2 });
    await caller.tags.create({ name: "Tailoring", slug: "tailoring" });
    await caller.tags.update({ id: 3, values: { name: "Tailoring", slug: "tailoring" } });
    await caller.tags.delete({ id: 3 });
    await caller.menus.save({ name: "Primary", location: "header", items: [{ id: "home", label: "Home", target: "url", url: "/" }] });
    await caller.media.upload(media);
    await caller.media.replace({ id: 5, ...media });
    await caller.media.update({ id: 5, values: { altText: "Editorial look" } });
    await caller.media.delete({ id: 5 });
    await caller.apiTokens.create({ name: "Automation", scopes: ["content:read"], expiresInDays: 30 });
    await caller.apiTokens.revoke({ id: 6 });
    await caller.settings.update(settings);
    await caller.appearance.update({ enabledPlugins: ["reading-time"] });

    expect(repository.createContentEntry).toHaveBeenCalledTimes(1);
    expect(repository.trashContentEntry).toHaveBeenCalledWith(10);
    expect(repository.restoreContentEntry).toHaveBeenCalledWith(10);
    expect(repository.upsertMenu).toHaveBeenCalledTimes(1);
    expect(mediaService.persistMediaReplacement).toHaveBeenCalledTimes(1);
    expect(repository.revokeApiToken).toHaveBeenCalledWith(6, 21);
    expect(repository.setBundledPluginActivation).toHaveBeenCalledWith(["reading-time"]);
  });

  it.each(["subscriber", "viewer"] as const)("denies %s from every CMS mutation procedure before any repository write", async role => {
    const caller = cmsRouter.createCaller(context(role));
    const content = { contentTypeKey: "post", title: "Restricted", slug: "restricted", status: "draft" as const };
    const media = { fileName: "restricted.jpg", mimeType: "image/jpeg", dataBase64: "ZmFrZQ==" };
    const settings = { siteTitle: "Atelier", siteDescription: "Journal", siteIndexing: true, homepageCategorySlugs: ["fashion"], footerTagline: "Considered", footerLocation: "London", footerInstagramUrl: "https://www.instagram.com/atelier" };

    await expect(caller.bootstrap()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.contentTypes.create({ key: "restricted", label: "Restricted", fieldDefinitions: [] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.content.create(content)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.content.update({ id: 10, values: { title: "Restricted" } })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.content.trash({ id: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.content.restore({ id: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.content.delete({ id: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.users.updateRole({ id: 22, role: "editor" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.categories.create({ name: "Restricted", slug: "restricted" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.categories.update({ id: 2, values: { name: "Restricted" } })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.categories.delete({ id: 2 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.tags.create({ name: "Restricted", slug: "restricted" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.tags.update({ id: 3, values: { name: "Restricted" } })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.tags.delete({ id: 3 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.menus.save({ name: "Restricted", location: "header", items: [{ id: "home", label: "Home", target: "url", url: "/" }] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.media.upload(media)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.media.replace({ id: 5, ...media })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.media.update({ id: 5, values: { altText: "Restricted" } })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.media.delete({ id: 5 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.apiTokens.create({ name: "Restricted", scopes: ["content:read"], expiresInDays: 30 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.apiTokens.revoke({ id: 6 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.settings.update(settings)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.appearance.update({ enabledPlugins: [] })).rejects.toMatchObject({ code: "FORBIDDEN" });

    expect(repository.createContentEntry).not.toHaveBeenCalled();
    expect(repository.setSettings).not.toHaveBeenCalled();
    expect(mediaService.persistMediaUpload).not.toHaveBeenCalled();
  });

  it.each(["editor", "author", "contributor", "subscriber", "viewer"] as const)("denies %s from every site-management mutation", async role => {
    const caller = cmsRouter.createCaller(context(role));
    const settings = { siteTitle: "Atelier", siteDescription: "Journal", siteIndexing: true, homepageCategorySlugs: ["fashion"], footerTagline: "Considered", footerLocation: "London", footerInstagramUrl: "https://www.instagram.com/atelier" };

    await expect(caller.bootstrap()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.contentTypes.create({ key: "restricted", label: "Restricted", fieldDefinitions: [] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.menus.save({ name: "Restricted", location: "header", items: [{ id: "home", label: "Home", target: "url", url: "/" }] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.settings.update(settings)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.appearance.update({ enabledPlugins: [] })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it.each(["subscriber", "viewer"] as const)("denies %s from every representative CMS mutation family", async role => {
    const caller = cmsRouter.createCaller(context(role));
    await expect(caller.contentTypes.create({ key: "restricted", label: "Restricted", fieldDefinitions: [] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.categories.create({ name: "Restricted", slug: "restricted" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.media.upload({ fileName: "restricted.jpg", mimeType: "image/jpeg", dataBase64: "ZmFrZQ==" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.apiTokens.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.bootstrap()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
