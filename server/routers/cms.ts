import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
  bootstrapCms,
  createApiTokenRecord,
  createCategory,
  createContentEntry,
  createCustomContentType,
  createTag,
  deleteCategory,
  deleteMediaRecord,
  deleteTag,
  getContentEntry,
  getUserById,
  getSettings,
  listApiTokensForUser,
  listCategories,
  listContentEntries,
  listContentTypes,
  listUsers,
  listMedia,
  listTags,
  revokeApiToken,
  updateCategory,
  updateContentEntry,
  updateMediaRecord,
  updateUserRole,
  setSettings,
  updateTag,
} from "../db";
import { issueApiToken, sha256 } from "../cms/apiTokens";
import { listEditorBlocks } from "../cms/blocks";
import { persistMediaUpload } from "../cms/media";
import { requireCapability, requireEntryOwnership, requireRoleChangeAllowed, type CmsCapability } from "../cms/permissions";
import { protectedProcedure, router } from "../_core/trpc";
import "../../plugins/registry";

const statusSchema = z.enum(["draft", "scheduled", "published", "archived"]);
const fieldSchema = z.object({
  key: z.string().min(1).max(64),
  label: z.string().min(1).max(120),
  type: z.enum(["text", "textarea", "number", "date", "boolean", "select", "media"]),
  required: z.boolean().optional(),
  options: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
});

function procedureWithCapability(capability: CmsCapability) {
  return protectedProcedure.use(({ ctx, next }) => {
    requireCapability(ctx.user, capability);
    return next();
  });
}

const contentInput = z
  .object({
    contentTypeKey: z.string().min(1).max(64),
    title: z.string().min(1).max(300),
    slug: z.string().min(1).max(320).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a lowercase URL slug."),
    excerpt: z.string().max(5000).nullable().optional(),
    bodyMarkdown: z.string().max(100_000).nullable().optional(),
    featuredMediaId: z.number().int().positive().nullable().optional(),
    status: statusSchema,
    scheduledAt: z.coerce.date().nullable().optional(),
    seoTitle: z.string().max(300).nullable().optional(),
    seoDescription: z.string().max(500).nullable().optional(),
    focusKeyword: z.string().max(120).nullable().optional(),
    canonicalUrl: z.string().url().nullable().optional(),
    robotsIndex: z.boolean().optional(),
    robotsFollow: z.boolean().optional(),
    ogTitle: z.string().max(300).nullable().optional(),
    ogDescription: z.string().max(500).nullable().optional(),
    ogImageMediaId: z.number().int().positive().nullable().optional(),
    fieldData: z.record(z.string(), z.unknown()).nullable().optional(),
    categoryIds: z.array(z.number().int().positive()).max(30).optional(),
    tagIds: z.array(z.number().int().positive()).max(30).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.status === "scheduled" && (!value.scheduledAt || value.scheduledAt.getTime() <= Date.now())) {
      ctx.addIssue({ code: "custom", path: ["scheduledAt"], message: "Scheduled content requires a future publication date." });
    }
  });

export const cmsRouter = router({
  bootstrap: procedureWithCapability("content:read").mutation(async () => {
    await bootstrapCms();
    return { success: true };
  }),
  editorBlocks: procedureWithCapability("content:read").query(() => listEditorBlocks()),
  contentTypes: router({
    list: procedureWithCapability("content:read").query(async () => {
      await bootstrapCms();
      return listContentTypes();
    }),
    create: procedureWithCapability("site:manage")
      .input(z.object({ key: z.string().regex(/^[a-z][a-z0-9_-]*$/), label: z.string().min(1), description: z.string().nullable().optional(), fieldDefinitions: z.array(fieldSchema) }))
      .mutation(({ input }) => createCustomContentType(input)),
  }),
  content: router({
    list: procedureWithCapability("content:read")
      .input(z.object({ contentTypeKey: z.string(), status: statusSchema.optional(), query: z.string().max(120).optional(), page: z.number().int().positive().optional(), perPage: z.number().int().positive().max(100).optional() }))
      .query(async ({ input }) => listContentEntries(input)),
    get: procedureWithCapability("content:read").input(z.object({ id: z.number().int().positive() })).query(({ input }) => getContentEntry(input.id)),
    create: procedureWithCapability("content:write").input(contentInput).mutation(async ({ ctx, input }) => {
      if (input.status === "published" || input.status === "scheduled") requireCapability(ctx.user, "content:publish");
      return createContentEntry({ ...input, authorId: ctx.user.id, bodyHtml: null });
    }),
    update: procedureWithCapability("content:write")
      .input(z.object({ id: z.number().int().positive(), values: contentInput.partial() }))
      .mutation(async ({ ctx, input }) => {
        const entry = await getContentEntry(input.id);
        if (!entry) throw new Error("Content entry not found.");
        requireEntryOwnership(ctx.user, entry);
        if (input.values.status === "published" || input.values.status === "scheduled") requireCapability(ctx.user, "content:publish");
        return updateContentEntry(input.id, { ...input.values, bodyHtml: undefined });
      }),
  }),
  users: router({
    list: procedureWithCapability("users:manage").query(listUsers),
    updateRole: procedureWithCapability("users:manage")
      .input(z.object({ id: z.number().int().positive(), role: z.enum(["admin", "editor", "author", "contributor", "subscriber", "viewer"]) }))
      .mutation(async ({ ctx, input }) => {
        const target = await getUserById(input.id);
        if (!target) throw new Error("User not found.");
        requireRoleChangeAllowed(ctx.user, target, input.role);
        return updateUserRole(input.id, input.role);
      }),
  }),
  categories: router({
    list: procedureWithCapability("content:read").query(listCategories),
    create: procedureWithCapability("taxonomy:write").input(z.object({ name: z.string().min(1).max(160), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), description: z.string().nullable().optional(), parentId: z.number().int().positive().nullable().optional() })).mutation(({ input }) => createCategory(input)),
    update: procedureWithCapability("taxonomy:write").input(z.object({ id: z.number().int().positive(), values: z.object({ name: z.string().min(1).max(160).optional(), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(), description: z.string().nullable().optional(), parentId: z.number().int().positive().nullable().optional() }) })).mutation(({ input }) => { if (input.values.parentId === input.id) throw new Error("A category cannot be its own parent."); return updateCategory(input.id, input.values); }),
    delete: procedureWithCapability("taxonomy:write").input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => { await deleteCategory(input.id); return { success: true }; }),
  }),
  tags: router({
    list: procedureWithCapability("content:read").query(listTags),
    create: procedureWithCapability("taxonomy:write").input(z.object({ name: z.string().min(1).max(160), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), description: z.string().nullable().optional() })).mutation(({ input }) => createTag(input)),
    update: procedureWithCapability("taxonomy:write").input(z.object({ id: z.number().int().positive(), values: z.object({ name: z.string().min(1).max(160).optional(), slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(), description: z.string().nullable().optional() }) })).mutation(({ input }) => updateTag(input.id, input.values)),
    delete: procedureWithCapability("taxonomy:write").input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => { await deleteTag(input.id); return { success: true }; }),
  }),
  media: router({
    list: procedureWithCapability("content:read")
      .input(z.object({ query: z.string().max(120).optional(), page: z.number().int().positive().optional(), perPage: z.number().int().positive().max(100).optional() }).optional())
      .query(({ input }) => listMedia(input)),
    upload: procedureWithCapability("media:write")
      .input(z.object({ fileName: z.string().min(1).max(255), mimeType: z.string().max(128), dataBase64: z.string().min(1).max(15_000_000), altText: z.string().max(500).nullable().optional(), title: z.string().max(255).nullable().optional() }))
      .mutation(({ ctx, input }) => persistMediaUpload({ ...input, uploadedById: ctx.user.id })),
    update: procedureWithCapability("media:write")
      .input(z.object({ id: z.number().int().positive(), values: z.object({ altText: z.string().max(500).nullable().optional(), title: z.string().max(255).nullable().optional(), caption: z.string().nullable().optional(), description: z.string().nullable().optional() }) }))
      .mutation(({ input }) => updateMediaRecord(input.id, input.values)),
    delete: procedureWithCapability("media:write").input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      await deleteMediaRecord(input.id);
      return { success: true };
    }),
  }),
  apiTokens: router({
    list: procedureWithCapability("token:manage").query(({ ctx }) => listApiTokensForUser(ctx.user.id)),
    create: procedureWithCapability("token:manage")
      .input(z.object({ name: z.string().min(1).max(120), scopes: z.array(z.enum(["content:read", "content:write", "media:write", "taxonomy:write"])).min(1), expiresInDays: z.number().int().min(1).max(365).default(30) }))
      .mutation(async ({ ctx, input }) => {
        const tokenId = nanoid(32);
        const expiresInSeconds = input.expiresInDays * 24 * 60 * 60;
        const token = await issueApiToken({ sub: String(ctx.user.id), role: ctx.user.role, scopes: input.scopes, tokenId }, process.env.JWT_SECRET ?? "", expiresInSeconds);
        const record = await createApiTokenRecord({
          userId: ctx.user.id,
          name: input.name,
          tokenId,
          tokenHash: await sha256(token),
          tokenPrefix: `${token.slice(0, 12)}…`,
          scopes: input.scopes,
          expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
        });
        return { record, token };
      }),
    revoke: procedureWithCapability("token:manage").input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await revokeApiToken(input.id, ctx.user.id);
      return { success: true };
    }),
  }),
  settings: router({
    get: procedureWithCapability("site:manage").query(async () => {
      await bootstrapCms();
      return getSettings();
    }),
    update: procedureWithCapability("site:manage")
      .input(z.object({ siteTitle: z.string().min(1).max(120), siteDescription: z.string().min(1).max(500), siteIndexing: z.boolean(), homepageCategorySlugs: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)).max(8) }))
      .mutation(async ({ ctx, input }) => setSettings([
        { key: "siteTitle", value: input.siteTitle, isPublic: true },
        { key: "siteDescription", value: input.siteDescription, isPublic: true },
        { key: "siteIndexing", value: input.siteIndexing, isPublic: true },
        { key: "homepageCategorySlugs", value: input.homepageCategorySlugs, isPublic: true },
      ], ctx.user.id)),
  }),
});
