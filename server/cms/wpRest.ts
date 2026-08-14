import type { Express, NextFunction, Request, Response } from "express";
import { TRPCError } from "@trpc/server";
import {
  createCategory,
  createContentEntry,
  createTag,
  deleteContentEntry,
  getContentEntry,
  getContentEntryBySlug,
  listCategories,
  listContentEntries,
  listMedia,
  listTags,
  restoreContentEntry,
  trashContentEntry,
  updateContentEntry,
} from "../db";
import { persistMediaReplacement, persistMediaUpload } from "./media";
import { authenticateRestRequest } from "./restAuth";
import { requireCapability, requireEntryOwnership } from "./permissions";

type Resource = "posts" | "pages" | "media" | "categories" | "tags";

const restWindows = new Map<string, { count: number; resetAt: number }>();
const REST_WINDOW_MS = 60_000;
const REST_MAX_REQUESTS = 120;

function developmentRestRateLimit(req: Request, res: Response, next: () => void) {
  const key = req.ip || req.header("x-forwarded-for") || "unknown";
  const now = Date.now();
  const existing = restWindows.get(key);
  const state = !existing || existing.resetAt <= now ? { count: 0, resetAt: now + REST_WINDOW_MS } : existing;
  state.count += 1;
  restWindows.set(key, state);
  res.setHeader("X-RateLimit-Limit", String(REST_MAX_REQUESTS));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(0, REST_MAX_REQUESTS - state.count)));
  if (state.count > REST_MAX_REQUESTS) return wpError(res, 429, "rest_rate_limited", "Too many requests. Please retry shortly.");
  next();
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character] ?? character);
}

function markdownToHtml(markdown: string | null) {
  if (!markdown) return "";
  return markdown
    .split(/\n{2,}/)
    .map(block => {
      const escaped = escapeHtml(block.trim()).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      if (escaped.startsWith("### ")) return `<h3>${escaped.slice(4)}</h3>`;
      if (escaped.startsWith("## ")) return `<h2>${escaped.slice(3)}</h2>`;
      if (escaped.startsWith("# ")) return `<h1>${escaped.slice(2)}</h1>`;
      return `<p>${escaped.replace(/\n/g, "<br />")}</p>`;
    })
    .join("\n");
}

function contentResponse(entry: Awaited<ReturnType<typeof getContentEntry>>) {
  if (!entry) return null;
  return {
    id: entry.id,
    date: entry.publishedAt?.toISOString() ?? entry.createdAt.toISOString(),
    modified: entry.updatedAt.toISOString(),
    slug: entry.slug,
    status: entry.status,
    type: "content",
    link: `/blog/${entry.slug}`,
    title: { rendered: entry.title },
    content: { rendered: markdownToHtml(entry.bodyMarkdown), raw: entry.bodyMarkdown ?? "" },
    excerpt: { rendered: entry.excerpt ? `<p>${escapeHtml(entry.excerpt)}</p>` : "", raw: entry.excerpt ?? "" },
    author: entry.authorId,
    featured_media: entry.featuredMediaId ?? 0,
    categories: entry.categories.map(category => category.id),
    tags: entry.tags.map(tag => tag.id),
    meta: {
      seo_title: entry.seoTitle,
      seo_description: entry.seoDescription,
      canonical_url: entry.canonicalUrl,
      robots_index: entry.robotsIndex,
      robots_follow: entry.robotsFollow,
      trashed_at: entry.trashedAt?.toISOString() ?? null,
    },
  };
}

function wpError(res: Response, status: number, code: string, message: string) {
  return res.status(status).json({ code, message, data: { status } });
}

function asNumber(value: unknown): number | undefined {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

async function requireWrite(req: Request, capability: "content:write" | "media:write" | "taxonomy:write") {
  return authenticateRestRequest(req.header("authorization"), capability);
}

export function registerWordPressRestRoutes(app: Express) {
  app.use("/api/wp/v2", developmentRestRateLimit);
  app.get("/api/wp/v2/:resource", async (req, res, next) => {
    try {
      const resource = req.params.resource as Resource;
      const page = Math.max(1, Number(req.query.page) || 1);
      const perPage = Math.min(100, Math.max(1, Number(req.query.per_page) || 10));
      if (resource === "posts" || resource === "pages") {
        const result = await listContentEntries({ contentTypeKey: resource === "posts" ? "post" : "page", publishedOnly: true, query: typeof req.query.search === "string" ? req.query.search : undefined, page, perPage });
        res.setHeader("X-WP-Total", String(result.total));
        res.setHeader("X-WP-TotalPages", String(Math.max(1, Math.ceil(result.total / perPage))));
        return res.json(result.entries.map(entry => contentResponse(entry)));
      }
      if (resource === "categories") return res.json(await listCategories());
      if (resource === "tags") return res.json(await listTags());
      if (resource === "media") return res.json(await listMedia({ page, perPage, query: typeof req.query.search === "string" ? req.query.search : undefined }));
      return wpError(res, 404, "rest_no_route", "No route was found matching the URL and request method.");
    } catch (error) { next(error); }
  });

  app.get("/api/wp/v2/:resource/:idOrSlug", async (req, res, next) => {
    try {
      const resource = req.params.resource as Resource;
      if (resource !== "posts" && resource !== "pages") return wpError(res, 404, "rest_no_route", "No route was found matching the URL and request method.");
      const type = resource === "posts" ? "post" : "page";
      const id = asNumber(req.params.idOrSlug);
      const entry = id ? await getContentEntry(id) : await getContentEntryBySlug(type, req.params.idOrSlug);
      if (!entry || entry.status !== "published" || entry.trashedAt) return wpError(res, 404, "rest_post_invalid_id", "Invalid post ID.");
      return res.json(contentResponse(entry));
    } catch (error) { next(error); }
  });

  app.post("/api/wp/v2/:resource", async (req, res, next) => {
    try {
      const resource = req.params.resource as Resource;
      if (resource === "posts" || resource === "pages") {
        const auth = await requireWrite(req, "content:write");
        const status = ["draft", "scheduled", "published", "archived"].includes(req.body.status) ? req.body.status : "draft";
        if (status === "published" || status === "scheduled") requireCapability(auth.user, "content:publish");
        const entry = await createContentEntry({
          contentTypeKey: resource === "posts" ? "post" : "page",
          authorId: auth.user.id,
          title: String(req.body.title?.raw ?? req.body.title ?? "").trim(),
          slug: String(req.body.slug ?? "").trim(),
          excerpt: String(req.body.excerpt?.raw ?? req.body.excerpt ?? "") || null,
          bodyMarkdown: String(req.body.content?.raw ?? req.body.content ?? ""),
          bodyHtml: null,
          status,
          scheduledAt: req.body.date ? new Date(req.body.date) : null,
          featuredMediaId: asNumber(req.body.featured_media) ?? null,
          categoryIds: Array.isArray(req.body.categories) ? req.body.categories.map(asNumber).filter(Boolean) as number[] : [],
          tagIds: Array.isArray(req.body.tags) ? req.body.tags.map(asNumber).filter(Boolean) as number[] : [],
          seoTitle: req.body.meta?.seo_title ?? null,
          seoDescription: req.body.meta?.seo_description ?? null,
          canonicalUrl: req.body.meta?.canonical_url ?? null,
          robotsIndex: req.body.meta?.robots_index ?? true,
          robotsFollow: req.body.meta?.robots_follow ?? true,
        });
        return res.status(201).json(contentResponse(entry));
      }
      if (resource === "categories") {
        await requireWrite(req, "taxonomy:write");
        return res.status(201).json(await createCategory({ name: String(req.body.name ?? ""), slug: String(req.body.slug ?? ""), description: req.body.description ?? null, parentId: asNumber(req.body.parent) ?? null }));
      }
      if (resource === "tags") {
        await requireWrite(req, "taxonomy:write");
        return res.status(201).json(await createTag({ name: String(req.body.name ?? ""), slug: String(req.body.slug ?? ""), description: req.body.description ?? null }));
      }
      if (resource === "media") {
        const auth = await requireWrite(req, "media:write");
        if (!req.body.fileName || !req.body.mimeType || !req.body.dataBase64) return wpError(res, 400, "rest_upload_invalid", "fileName, mimeType, and dataBase64 are required.");
        return res.status(201).json(await persistMediaUpload({ ...req.body, uploadedById: auth.user.id }));
      }
      return wpError(res, 404, "rest_no_route", "No route was found matching the URL and request method.");
    } catch (error) { next(error); }
  });

  app.patch("/api/wp/v2/:resource/:id", async (req, res, next) => {
    try {
      const resource = req.params.resource as Resource;
      if (resource === "media") {
        const auth = await requireWrite(req, "media:write");
        if (!req.body.fileName || !req.body.mimeType || !req.body.dataBase64) return wpError(res, 400, "rest_upload_invalid", "fileName, mimeType, and dataBase64 are required.");
        return res.json(await persistMediaReplacement({ mediaId: Number(req.params.id), fileName: req.body.fileName, mimeType: req.body.mimeType, dataBase64: req.body.dataBase64, uploadedById: auth.user.id }));
      }
      if (resource !== "posts" && resource !== "pages") return wpError(res, 404, "rest_no_route", "No route was found matching the URL and request method.");
      const auth = await requireWrite(req, "content:write");
      const existing = await getContentEntry(Number(req.params.id));
      if (!existing) return wpError(res, 404, "rest_post_invalid_id", "Invalid post ID.");
      requireEntryOwnership(auth.user, existing);
      if (req.query.restore === "true") {
        const restored = await restoreContentEntry(existing.id);
        if (!restored) return wpError(res, 409, "rest_invalid_status", "Only trashed content can be restored.");
        return res.json(contentResponse(restored));
      }
      if (existing.trashedAt) return wpError(res, 409, "rest_invalid_status", "Restore trashed content before editing it.");
      const status = req.body.status;
      if (status === "published" || status === "scheduled") requireCapability(auth.user, "content:publish");
      const entry = await updateContentEntry(Number(req.params.id), {
        title: req.body.title ? String(req.body.title.raw ?? req.body.title) : undefined,
        slug: req.body.slug ? String(req.body.slug) : undefined,
        excerpt: req.body.excerpt ? String(req.body.excerpt.raw ?? req.body.excerpt) : undefined,
        bodyMarkdown: req.body.content ? String(req.body.content.raw ?? req.body.content) : undefined,
        status,
        scheduledAt: req.body.date ? new Date(req.body.date) : undefined,
      });
      if (!entry) return wpError(res, 404, "rest_post_invalid_id", "Invalid post ID.");
      return res.json(contentResponse(entry));
    } catch (error) { next(error); }
  });

  app.delete("/api/wp/v2/:resource/:id", async (req, res, next) => {
    try {
      const resource = req.params.resource as Resource;
      if (resource !== "posts" && resource !== "pages") return wpError(res, 404, "rest_no_route", "No route was found matching the URL and request method.");
      const auth = await requireWrite(req, "content:write");
      const existing = await getContentEntry(Number(req.params.id));
      if (!existing) return wpError(res, 404, "rest_post_invalid_id", "Invalid post ID.");
      requireEntryOwnership(auth.user, existing);
      if (req.query.force === "true") {
        const deleted = await deleteContentEntry(existing.id);
        if (!deleted) return wpError(res, 404, "rest_post_invalid_id", "Invalid post ID.");
        return res.json({ deleted: true, previous: contentResponse(existing) });
      }
      const trashed = await trashContentEntry(existing.id);
      if (!trashed) return wpError(res, 409, "rest_invalid_status", "Content is already in the trash.");
      return res.json({ deleted: false, trashed: true, previous: contentResponse(existing), content: contentResponse(trashed) });
    } catch (error) { next(error); }
  });

  app.use("/api/wp/v2", (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof TRPCError) return wpError(res, error.code === "FORBIDDEN" ? 403 : 401, `cms_${error.code.toLowerCase()}`, error.message);
    console.error("[CMS REST]", error);
    return wpError(res, 500, "cms_server_error", "The CMS could not process this request.");
  });
}
