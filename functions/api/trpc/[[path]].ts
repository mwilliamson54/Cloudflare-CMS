import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { clearAuthCookies, currentSession, requireCsrf, type AuthEnv } from "../../_shared/auth";

type Context = { request: Request; env: AuthEnv & { CMS_DB: D1Database; CMS_MEDIA?: R2Bucket } };

const t = initTRPC.context<Context>().create();
const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  const session = await currentSession(ctx.request, ctx.env);
  if (!session) throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication required." });
  return next({ ctx: { ...ctx, session } });
});

const mutation = protectedProcedure.use(async ({ ctx, next }) => {
  const sessionId = ctx.session.sessionId;
  if (!(await requireCsrf(ctx.request, { csrfHash: ctx.session.csrfHash }))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "CSRF validation failed." });
  }
  return next({ ctx: { ...ctx, sessionId } });
});

const unsupported = () => {
  throw new TRPCError({ code: "NOT_IMPLEMENTED", message: "This dashboard procedure is not yet available in the Cloudflare D1 adapter." });
};

const statusSchema = z.enum(["draft", "scheduled", "published", "archived"]);
const contentListInput = z.object({ contentTypeKey: z.string().min(1), status: statusSchema.optional(), trashed: z.boolean().optional(), query: z.string().max(120).optional(), page: z.number().int().positive().optional(), perPage: z.number().int().positive().max(100).optional() });
const contentInput = z.object({ contentTypeKey: z.string().min(1), title: z.string().min(1).max(300), slug: z.string().min(1).max(320).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), excerpt: z.string().max(5000).nullable().optional(), bodyMarkdown: z.string().max(100_000).nullable().optional(), featuredMediaId: z.number().int().positive().nullable().optional(), parentId: z.number().int().positive().nullable().optional(), templateKey: z.enum(["default", "landing", "narrative", "lookbook", "minimal"]).default("default"), status: statusSchema, scheduledAt: z.coerce.date().nullable().optional(), seoTitle: z.string().max(300).nullable().optional(), seoDescription: z.string().max(500).nullable().optional(), canonicalUrl: z.string().url().nullable().optional(), robotsIndex: z.boolean().optional(), robotsFollow: z.boolean().optional() });
const canPublish = new Set(["admin", "editor", "author"]);
const mediaTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif", "application/pdf"]);
const base64Bytes = (value: string) => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=")), character => character.charCodeAt(0));
const mediaView = (row: Record<string, unknown>) => ({ ...row, id: Number(row.id), sizeBytes: Number(row.size_bytes), uploadedById: Number(row.uploaded_by_id), altText: row.alt_text ?? null, originalFileName: row.original_file_name, mimeType: row.mime_type, storageKey: row.storage_key, sourceUrl: row.url });
const requireRole = (role: string, allowed: string[]) => { if (!allowed.includes(role)) throw new TRPCError({ code: "FORBIDDEN", message: "This role cannot perform that operation." }); };
const rowToContent = (row: Record<string, unknown>) => ({ ...row, id: Number(row.id), contentTypeId: Number(row.content_type_id), authorId: Number(row.author_id), featuredMediaId: row.featured_media_id == null ? null : Number(row.featured_media_id), parentId: row.parent_id == null ? null : Number(row.parent_id), robotsIndex: Boolean(row.robots_index), robotsFollow: Boolean(row.robots_follow), scheduledAt: row.scheduled_at ? new Date(String(row.scheduled_at)) : null, publishedAt: row.published_at ? new Date(String(row.published_at)) : null, archivedAt: row.archived_at ? new Date(String(row.archived_at)) : null, trashedAt: row.trashed_at ? new Date(String(row.trashed_at)) : null, createdAt: new Date(String(row.created_at)), updatedAt: new Date(String(row.updated_at)), contentTypeKey: String(row.content_type_key) });

export const appRouter = t.router({
  auth: t.router({
    me: t.procedure.query(async ({ ctx }) => (await currentSession(ctx.request, ctx.env))?.user ?? null),
    logout: mutation.mutation(async ({ ctx }) => {
      await ctx.env.CMS_DB.prepare("UPDATE auth_sessions SET revoked_at=? WHERE id=?").bind(new Date().toISOString(), ctx.sessionId).run();
      return { success: true } as const;
    }),
  }),
  cms: t.router({
    bootstrap: mutation.mutation(() => unsupported()),
    media: t.router({
      list: protectedProcedure.input(z.object({ query: z.string().max(120).optional(), page: z.number().int().positive().optional(), perPage: z.number().int().positive().max(100).optional() }).optional()).query(async ({ ctx, input }) => { const page = input?.page ?? 1; const perPage = input?.perPage ?? 30; const query = input?.query?.trim(); const filter = query ? " WHERE original_file_name LIKE ? OR title LIKE ? OR alt_text LIKE ?" : ""; const term = query ? `%${query}%` : null; const count = await ctx.env.CMS_DB.prepare(`SELECT COUNT(*) AS total FROM media${filter}`).bind(...(term ? [term, term, term] : [])).first<{ total: number }>(); const rows = await ctx.env.CMS_DB.prepare(`SELECT * FROM media${filter} ORDER BY created_at DESC LIMIT ? OFFSET ?`).bind(...(term ? [term, term, term] : []), perPage, (page - 1) * perPage).all<Record<string, unknown>>(); return { media: rows.results.map(mediaView), total: Number(count?.total ?? 0), page, perPage }; }),
      upload: mutation.input(z.object({ fileName: z.string().min(1).max(255), mimeType: z.string().max(128), dataBase64: z.string().min(1).max(15_000_000), altText: z.string().max(500).nullable().optional(), title: z.string().max(255).nullable().optional() })).mutation(async ({ ctx, input }) => { requireRole(ctx.session.user.role, ["admin", "editor", "author", "contributor"]); if (!ctx.env.CMS_MEDIA) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "CMS_MEDIA R2 binding is not configured." }); if (!mediaTypes.has(input.mimeType)) throw new TRPCError({ code: "BAD_REQUEST", message: "Unsupported media type." }); const bytes = base64Bytes(input.dataBase64); if (!bytes.byteLength || bytes.byteLength > 10 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Media uploads must be between 1 byte and 10 MB." }); const safe = input.fileName.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 160) || "upload"; const ext = input.mimeType.split("/")[1].replace("jpeg", "jpg"); const date = new Date(); const key = `uploads/${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/u${ctx.session.user.id}/${safe}-${crypto.randomUUID().slice(0, 8)}.${ext}`; await ctx.env.CMS_MEDIA.put(key, bytes, { httpMetadata: { contentType: input.mimeType } }); const url = `/media/${key.split("/").map(encodeURIComponent).join("/")}`; const result = await ctx.env.CMS_DB.prepare("INSERT INTO media (storage_key,storage_provider,url,file_name,original_file_name,mime_type,size_bytes,alt_text,title,uploaded_by_id) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(key, "cloudflare-r2", url, `${safe}.${ext}`, input.fileName, input.mimeType, bytes.byteLength, input.altText ?? null, input.title ?? null, ctx.session.user.id).run(); return { id: Number(result.meta.last_row_id), sourceUrl: url, altText: input.altText ?? "", title: input.title ?? null }; }),
      update: mutation.input(z.object({ id: z.number().int().positive(), values: z.object({ altText: z.string().max(500).nullable().optional(), title: z.string().max(255).nullable().optional(), caption: z.string().nullable().optional(), description: z.string().nullable().optional() }) })).mutation(async ({ ctx, input }) => { const row = await ctx.env.CMS_DB.prepare("SELECT * FROM media WHERE id=? LIMIT 1").bind(input.id).first<Record<string, unknown>>(); if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Media record not found." }); if (["author", "contributor"].includes(ctx.session.user.role) && Number(row.uploaded_by_id) !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "You may only edit media you uploaded." }); await ctx.env.CMS_DB.prepare("UPDATE media SET alt_text=?,title=?,caption=?,description=?,updated_at=? WHERE id=?").bind(input.values.altText === undefined ? row.alt_text : input.values.altText, input.values.title === undefined ? row.title : input.values.title, input.values.caption === undefined ? row.caption : input.values.caption, input.values.description === undefined ? row.description : input.values.description, new Date().toISOString(), input.id).run(); return { id: input.id, ...input.values }; }),
      delete: mutation.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const row = await ctx.env.CMS_DB.prepare("SELECT storage_key,uploaded_by_id FROM media WHERE id=? LIMIT 1").bind(input.id).first<{ storage_key: string; uploaded_by_id: number }>(); if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Media record not found." }); if (["author", "contributor"].includes(ctx.session.user.role) && Number(row.uploaded_by_id) !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "You may only delete media you uploaded." }); if (ctx.env.CMS_MEDIA) await ctx.env.CMS_MEDIA.delete(row.storage_key); await ctx.env.CMS_DB.prepare("DELETE FROM media WHERE id=?").bind(input.id).run(); return { success: true }; }),
    }),
    settings: t.router({
      get: protectedProcedure.query(async ({ ctx }) => { const rows = (await ctx.env.CMS_DB.prepare("SELECT namespace,key,value,is_public FROM site_settings ORDER BY namespace,key").all<Record<string, unknown>>()).results; return Object.fromEntries(rows.map(row => [String(row.key), (() => { try { return JSON.parse(String(row.value)); } catch { return row.value; } })()])); }),
      update: mutation.input(z.object({ key: z.string().min(1).max(120), value: z.unknown() })).mutation(async ({ ctx, input }) => { requireRole(ctx.session.user.role, ["admin"]); await ctx.env.CMS_DB.prepare("INSERT INTO site_settings(namespace,key,value,is_public,updated_by_id,updated_at) VALUES ('site',?,?,0,?,?) ON CONFLICT(namespace,key) DO UPDATE SET value=excluded.value,updated_by_id=excluded.updated_by_id,updated_at=excluded.updated_at").bind(input.key, JSON.stringify(input.value), ctx.session.user.id, new Date().toISOString()).run(); return { key: input.key, value: input.value }; }),
    }),
    categories: t.router({
      list: protectedProcedure.query(async ({ ctx }) => (await ctx.env.CMS_DB.prepare("SELECT * FROM categories ORDER BY name").all<Record<string, unknown>>()).results),
      create: mutation.input(z.object({ name: z.string().min(1).max(160), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), description: z.string().nullable().optional(), parentId: z.number().int().positive().nullable().optional() })).mutation(async ({ ctx, input }) => { requireRole(ctx.session.user.role, ["admin", "editor", "author", "contributor"]); const result = await ctx.env.CMS_DB.prepare("INSERT INTO categories (name,slug,description,parent_id) VALUES (?,?,?,?)").bind(input.name, input.slug, input.description ?? null, input.parentId ?? null).run(); return { id: Number(result.meta.last_row_id), ...input }; }),
      update: mutation.input(z.object({ id: z.number().int().positive(), values: z.object({ name: z.string().min(1).max(160).optional(), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(), description: z.string().nullable().optional(), parentId: z.number().int().positive().nullable().optional() }) })).mutation(async ({ ctx, input }) => { requireRole(ctx.session.user.role, ["admin", "editor"]); const current = await ctx.env.CMS_DB.prepare("SELECT * FROM categories WHERE id=?").bind(input.id).first<Record<string, unknown>>(); if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Category not found." }); if (input.values.parentId === input.id) throw new TRPCError({ code: "BAD_REQUEST", message: "A category cannot be its own parent." }); await ctx.env.CMS_DB.prepare("UPDATE categories SET name=?,slug=?,description=?,parent_id=? WHERE id=?").bind(input.values.name ?? current.name, input.values.slug ?? current.slug, input.values.description === undefined ? current.description : input.values.description, input.values.parentId === undefined ? current.parent_id : input.values.parentId, input.id).run(); return { id: input.id, ...input.values }; }),
      delete: mutation.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { requireRole(ctx.session.user.role, ["admin", "editor"]); await ctx.env.CMS_DB.prepare("DELETE FROM categories WHERE id=?").bind(input.id).run(); return { success: true }; }),
    }),
    tags: t.router({
      list: protectedProcedure.query(async ({ ctx }) => (await ctx.env.CMS_DB.prepare("SELECT * FROM tags ORDER BY name").all<Record<string, unknown>>()).results),
      create: mutation.input(z.object({ name: z.string().min(1).max(160), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), description: z.string().nullable().optional() })).mutation(async ({ ctx, input }) => { requireRole(ctx.session.user.role, ["admin", "editor", "author", "contributor"]); const result = await ctx.env.CMS_DB.prepare("INSERT INTO tags (name,slug,description) VALUES (?,?,?)").bind(input.name, input.slug, input.description ?? null).run(); return { id: Number(result.meta.last_row_id), ...input }; }),
      update: mutation.input(z.object({ id: z.number().int().positive(), values: z.object({ name: z.string().min(1).max(160).optional(), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(), description: z.string().nullable().optional() }) })).mutation(async ({ ctx, input }) => { requireRole(ctx.session.user.role, ["admin", "editor"]); const current = await ctx.env.CMS_DB.prepare("SELECT * FROM tags WHERE id=?").bind(input.id).first<Record<string, unknown>>(); if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Tag not found." }); await ctx.env.CMS_DB.prepare("UPDATE tags SET name=?,slug=?,description=? WHERE id=?").bind(input.values.name ?? current.name, input.values.slug ?? current.slug, input.values.description === undefined ? current.description : input.values.description, input.id).run(); return { id: input.id, ...input.values }; }),
      delete: mutation.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { requireRole(ctx.session.user.role, ["admin", "editor"]); await ctx.env.CMS_DB.prepare("DELETE FROM tags WHERE id=?").bind(input.id).run(); return { success: true }; }),
    }),
    content: t.router({
      list: protectedProcedure.input(contentListInput).query(async ({ ctx, input }) => {
        const page = input.page ?? 1;
        const perPage = input.perPage ?? 20;
        const conditions = ["t.key=?"];
        const bindings: unknown[] = [input.contentTypeKey];
        if (input.status) { conditions.push("e.status=?"); bindings.push(input.status); }
        if (input.trashed === true) conditions.push("e.trashed_at IS NOT NULL");
        else conditions.push("e.trashed_at IS NULL");
        if (input.query) { conditions.push("(e.title LIKE ? OR e.slug LIKE ? OR e.excerpt LIKE ?)"); const term = `%${input.query}%`; bindings.push(term, term, term); }
        const where = conditions.join(" AND ");
        const count = await ctx.env.CMS_DB.prepare(`SELECT COUNT(*) AS total FROM content_entries e JOIN content_types t ON t.id=e.content_type_id WHERE ${where}`).bind(...bindings).first<{ total: number }>();
        const rows = await ctx.env.CMS_DB.prepare(`SELECT e.*, t.key AS content_type_key FROM content_entries e JOIN content_types t ON t.id=e.content_type_id WHERE ${where} ORDER BY e.updated_at DESC LIMIT ? OFFSET ?`).bind(...bindings, perPage, (page - 1) * perPage).all<Record<string, unknown>>();
        return { entries: rows.results.map(rowToContent), total: Number(count?.total ?? 0), page, perPage };
      }),
      get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
        const row = await ctx.env.CMS_DB.prepare("SELECT e.*, t.key AS content_type_key FROM content_entries e JOIN content_types t ON t.id=e.content_type_id WHERE e.id=? LIMIT 1").bind(input.id).first<Record<string, unknown>>();
        return row ? rowToContent(row) : null;
      }),
      create: mutation.input(contentInput).mutation(async ({ ctx, input }) => {
        requireRole(ctx.session.user.role, ["admin", "editor", "author", "contributor"]);
        if (input.status === "published" || input.status === "scheduled") requireRole(ctx.session.user.role, [...canPublish]);
        const type = await ctx.env.CMS_DB.prepare("SELECT id FROM content_types WHERE key=? LIMIT 1").bind(input.contentTypeKey).first<{ id: number }>();
        if (!type) throw new TRPCError({ code: "BAD_REQUEST", message: "Content type not found." });
        const now = new Date().toISOString();
        const scheduledAt = input.status === "scheduled" ? input.scheduledAt?.toISOString() ?? null : null;
        const publishedAt = input.status === "published" ? now : null;
        const result = await ctx.env.CMS_DB.prepare("INSERT INTO content_entries (content_type_id,author_id,title,slug,excerpt,body_markdown,featured_media_id,parent_id,template_key,status,scheduled_at,published_at,seo_title,seo_description,canonical_url,robots_index,robots_follow,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(type.id, ctx.session.user.id, input.title, input.slug, input.excerpt ?? null, input.bodyMarkdown ?? null, input.featuredMediaId ?? null, input.parentId ?? null, input.templateKey, input.status, scheduledAt, publishedAt, input.seoTitle ?? null, input.seoDescription ?? null, input.canonicalUrl ?? null, input.robotsIndex === false ? 0 : 1, input.robotsFollow === false ? 0 : 1, now, now).run();
        const row = await ctx.env.CMS_DB.prepare("SELECT e.*, t.key AS content_type_key FROM content_entries e JOIN content_types t ON t.id=e.content_type_id WHERE e.id=?").bind(result.meta.last_row_id).first<Record<string, unknown>>();
        return row ? rowToContent(row) : null;
      }),
      update: mutation.input(z.object({ id: z.number().int().positive(), values: contentInput.partial() })).mutation(async ({ ctx, input }) => {
        const existing = await ctx.env.CMS_DB.prepare("SELECT e.*, t.key AS content_type_key FROM content_entries e JOIN content_types t ON t.id=e.content_type_id WHERE e.id=? LIMIT 1").bind(input.id).first<Record<string, unknown>>();
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Content entry not found." });
        if (["author", "contributor"].includes(ctx.session.user.role) && Number(existing.author_id) !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "You may only edit content you authored." });
        if (input.values.status === "published" || input.values.status === "scheduled") requireRole(ctx.session.user.role, [...canPublish]);
        if (existing.trashed_at) throw new TRPCError({ code: "CONFLICT", message: "Restore trashed content before editing it." });
        const values = input.values;
        const now = new Date().toISOString();
        const status = values.status ?? String(existing.status);
        await ctx.env.CMS_DB.prepare("UPDATE content_entries SET title=?,slug=?,excerpt=?,body_markdown=?,featured_media_id=?,parent_id=?,template_key=?,status=?,scheduled_at=?,published_at=?,seo_title=?,seo_description=?,canonical_url=?,robots_index=?,robots_follow=?,updated_at=? WHERE id=?").bind(values.title ?? existing.title, values.slug ?? existing.slug, values.excerpt === undefined ? existing.excerpt : values.excerpt, values.bodyMarkdown === undefined ? existing.body_markdown : values.bodyMarkdown, values.featuredMediaId === undefined ? existing.featured_media_id : values.featuredMediaId, values.parentId === undefined ? existing.parent_id : values.parentId, values.templateKey ?? existing.template_key, status, status === "scheduled" ? (values.scheduledAt?.toISOString() ?? existing.scheduled_at) : null, status === "published" ? (existing.published_at ?? now) : null, values.seoTitle === undefined ? existing.seo_title : values.seoTitle, values.seoDescription === undefined ? existing.seo_description : values.seoDescription, values.canonicalUrl === undefined ? existing.canonical_url : values.canonicalUrl, values.robotsIndex === undefined ? existing.robots_index : values.robotsIndex ? 1 : 0, values.robotsFollow === undefined ? existing.robots_follow : values.robotsFollow ? 1 : 0, now, input.id).run();
        const row = await ctx.env.CMS_DB.prepare("SELECT e.*, t.key AS content_type_key FROM content_entries e JOIN content_types t ON t.id=e.content_type_id WHERE e.id=?").bind(input.id).first<Record<string, unknown>>();
        return row ? rowToContent(row) : null;
      }),
      delete: mutation.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { requireRole(ctx.session.user.role, ["admin"]); await ctx.env.CMS_DB.prepare("DELETE FROM content_entries WHERE id=?").bind(input.id).run(); return { deleted: true }; }),
      trash: mutation.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const row = await ctx.env.CMS_DB.prepare("SELECT author_id,trashed_at FROM content_entries WHERE id=?").bind(input.id).first<{ author_id: number; trashed_at: string | null }>(); if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Content entry not found." }); if (["author", "contributor"].includes(ctx.session.user.role) && Number(row.author_id) !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "You may only manage content you authored." }); const now = new Date().toISOString(); await ctx.env.CMS_DB.prepare("UPDATE content_entries SET trashed_at=?,updated_at=? WHERE id=?").bind(now, now, input.id).run(); return { id: input.id, trashedAt: new Date(now) }; }),
      restore: mutation.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { const row = await ctx.env.CMS_DB.prepare("SELECT author_id,trashed_at FROM content_entries WHERE id=?").bind(input.id).first<{ author_id: number; trashed_at: string | null }>(); if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Content entry not found." }); if (!row.trashed_at) throw new TRPCError({ code: "CONFLICT", message: "Content entry is not in the trash." }); if (["author", "contributor"].includes(ctx.session.user.role) && Number(row.author_id) !== ctx.session.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "You may only manage content you authored." }); await ctx.env.CMS_DB.prepare("UPDATE content_entries SET trashed_at=NULL,updated_at=? WHERE id=?").bind(new Date().toISOString(), input.id).run(); const restored = await ctx.env.CMS_DB.prepare("SELECT e.*,t.key AS content_type_key FROM content_entries e JOIN content_types t ON t.id=e.content_type_id WHERE e.id=?").bind(input.id).first<Record<string, unknown>>(); return restored ? rowToContent(restored) : null; }),
    }),
  }),
});

export type CloudflareTrpcRouter = typeof appRouter;

export const onRequest = async (context: { request: Request; env: AuthEnv & { CMS_DB: D1Database; CMS_MEDIA?: R2Bucket }; params: { path?: string[] | string } }) => {
  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req: context.request,
    router: appRouter,
    createContext: () => ({ request: context.request, env: context.env }),
    onError({ error }) {
      console.error("Cloudflare tRPC error", error.message);
    },
  });
  const path = Array.isArray(context.params.path) ? context.params.path.join(".") : String(context.params.path ?? "");
  if (path === "auth.logout" && response.ok) {
    const headers = new Headers(response.headers);
    for (const value of clearAuthCookies()) headers.append("set-cookie", value);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
  return response;
};

export const onRequestPost = onRequest;
export const onRequestGet = onRequest;

