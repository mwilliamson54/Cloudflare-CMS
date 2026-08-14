import { and, desc, eq, inArray, isNull, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  apiTokens,
  categories,
  contentCategories,
  contentEntries,
  contentTags,
  contentTypes,
  media,
  siteSettings,
  type ApiTokenScope,
  type ContentFieldDefinition,
  type InsertUser,
  tags,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let database: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!database && process.env.DATABASE_URL) {
    database = drizzle(process.env.DATABASE_URL);
  }
  return database;
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("The CMS database is not configured.");
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert.");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId, lastSignedIn: new Date() };
  const updateSet: Record<string, unknown> = { lastSignedIn: new Date() };
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  values.role = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : "viewer");
  updateSet.role = values.role;
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(users).where(eq(users.openId, openId)).limit(1))[0];
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(users).where(eq(users.id, id)).limit(1))[0];
}

export async function listUsers() {
  const db = await requireDb();
  return db.select().from(users).orderBy(users.name, users.id);
}

export async function updateUserRole(id: number, role: InsertUser["role"]) {
  const db = await requireDb();
  await db.update(users).set({ role }).where(eq(users.id, id));
  return getUserById(id);
}

export async function bootstrapCms(): Promise<void> {
  const db = await requireDb();
  const systemTypes: Array<{
    key: string;
    label: string;
    kind: "post" | "page";
    fieldDefinitions: ContentFieldDefinition[];
  }> = [
    {
      key: "post",
      label: "Posts",
      kind: "post",
      fieldDefinitions: [
        { key: "title", label: "Title", type: "text", required: true },
        { key: "body", label: "Body", type: "textarea" },
      ],
    },
    {
      key: "page",
      label: "Pages",
      kind: "page",
      fieldDefinitions: [
        { key: "title", label: "Title", type: "text", required: true },
        { key: "body", label: "Body", type: "textarea" },
      ],
    },
  ];
  for (const entry of systemTypes) {
    await db
      .insert(contentTypes)
      .values({ ...entry, isSystem: true })
      .onDuplicateKeyUpdate({ set: { label: entry.label, fieldDefinitions: entry.fieldDefinitions } });
  }
  const defaults: Array<{ key: string; value: unknown; isPublic: boolean }> = [
    { key: "siteTitle", value: "Atelier Journal", isPublic: true },
    { key: "siteDescription", value: "An independent journal of fashion, culture, and considered living.", isPublic: true },
    { key: "siteIndexing", value: true, isPublic: true },
    { key: "homepageCategorySlugs", value: ["fashion", "street-style", "inspiration"], isPublic: true },
    { key: "theme", value: "fashion-editorial", isPublic: true },
  ];
  for (const setting of defaults) {
    await db.insert(siteSettings).values({ namespace: "site", ...setting }).onDuplicateKeyUpdate({ set: { key: setting.key } });
  }
}

export async function listContentTypes() {
  const db = await requireDb();
  return db.select().from(contentTypes).orderBy(contentTypes.label);
}

export async function createCustomContentType(input: {
  key: string;
  label: string;
  description?: string | null;
  fieldDefinitions: ContentFieldDefinition[];
}) {
  const db = await requireDb();
  const result = await db.insert(contentTypes).values({ ...input, kind: "custom", isSystem: false });
  return (await db.select().from(contentTypes).where(eq(contentTypes.id, Number(result[0].insertId))).limit(1))[0] ?? null;
}

export async function getContentTypeByKey(key: string) {
  const db = await requireDb();
  return (await db.select().from(contentTypes).where(eq(contentTypes.key, key)).limit(1))[0] ?? null;
}

export type CreateContentInput = {
  contentTypeKey: string;
  authorId: number;
  title: string;
  slug: string;
  excerpt?: string | null;
  bodyMarkdown?: string | null;
  bodyHtml?: string | null;
  featuredMediaId?: number | null;
  parentId?: number | null;
  templateKey?: string;
  status: "draft" | "scheduled" | "published" | "archived";
  scheduledAt?: Date | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  focusKeyword?: string | null;
  canonicalUrl?: string | null;
  robotsIndex?: boolean;
  robotsFollow?: boolean;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImageMediaId?: number | null;
  fieldData?: Record<string, unknown> | null;
  categoryIds?: number[];
  tagIds?: number[];
};

function statusDates(status: CreateContentInput["status"], scheduledAt?: Date | null) {
  const now = new Date();
  if (status === "published") return { publishedAt: now, scheduledAt: null, archivedAt: null };
  if (status === "scheduled") return { scheduledAt: scheduledAt ?? null, publishedAt: null, archivedAt: null };
  if (status === "archived") return { archivedAt: now, scheduledAt: null, publishedAt: null };
  return { scheduledAt: null, publishedAt: null, archivedAt: null };
}

export async function createContentEntry(input: CreateContentInput) {
  const db = await requireDb();
  const contentType = await getContentTypeByKey(input.contentTypeKey);
  if (!contentType) throw new Error("Unknown content type.");
  const dates = statusDates(input.status, input.scheduledAt);
  const result = await db.insert(contentEntries).values({
    contentTypeId: contentType.id,
    authorId: input.authorId,
    title: input.title,
    slug: input.slug,
    excerpt: input.excerpt ?? null,
    bodyMarkdown: input.bodyMarkdown ?? null,
    bodyHtml: input.bodyHtml ?? null,
    featuredMediaId: input.featuredMediaId ?? null,
    parentId: input.parentId ?? null,
    templateKey: input.templateKey ?? "default",
    status: input.status,
    ...dates,
    seoTitle: input.seoTitle ?? null,
    seoDescription: input.seoDescription ?? null,
    focusKeyword: input.focusKeyword ?? null,
    canonicalUrl: input.canonicalUrl ?? null,
    robotsIndex: input.robotsIndex ?? true,
    robotsFollow: input.robotsFollow ?? true,
    ogTitle: input.ogTitle ?? null,
    ogDescription: input.ogDescription ?? null,
    ogImageMediaId: input.ogImageMediaId ?? null,
    fieldData: input.fieldData ?? null,
  });
  const contentEntryId = Number(result[0].insertId);
  await replaceEntryTaxonomies(contentEntryId, input.categoryIds ?? [], input.tagIds ?? []);
  return getContentEntry(contentEntryId);
}

export async function updateContentEntry(id: number, input: Partial<CreateContentInput>) {
  const db = await requireDb();
  const existing = await getContentEntry(id);
  if (!existing) return null;
  const dates = input.status ? statusDates(input.status, input.scheduledAt) : {};
  await db
    .update(contentEntries)
    .set({
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.excerpt !== undefined ? { excerpt: input.excerpt } : {}),
      ...(input.bodyMarkdown !== undefined ? { bodyMarkdown: input.bodyMarkdown } : {}),
      ...(input.bodyHtml !== undefined ? { bodyHtml: input.bodyHtml } : {}),
      ...(input.featuredMediaId !== undefined ? { featuredMediaId: input.featuredMediaId } : {}),
      ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
      ...(input.templateKey !== undefined ? { templateKey: input.templateKey } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...dates,
      ...(input.seoTitle !== undefined ? { seoTitle: input.seoTitle } : {}),
      ...(input.seoDescription !== undefined ? { seoDescription: input.seoDescription } : {}),
      ...(input.focusKeyword !== undefined ? { focusKeyword: input.focusKeyword } : {}),
      ...(input.canonicalUrl !== undefined ? { canonicalUrl: input.canonicalUrl } : {}),
      ...(input.robotsIndex !== undefined ? { robotsIndex: input.robotsIndex } : {}),
      ...(input.robotsFollow !== undefined ? { robotsFollow: input.robotsFollow } : {}),
      ...(input.ogTitle !== undefined ? { ogTitle: input.ogTitle } : {}),
      ...(input.ogDescription !== undefined ? { ogDescription: input.ogDescription } : {}),
      ...(input.ogImageMediaId !== undefined ? { ogImageMediaId: input.ogImageMediaId } : {}),
      ...(input.fieldData !== undefined ? { fieldData: input.fieldData } : {}),
    })
    .where(eq(contentEntries.id, id));
  if (input.categoryIds !== undefined || input.tagIds !== undefined) {
    await replaceEntryTaxonomies(id, input.categoryIds ?? [], input.tagIds ?? []);
  }
  return getContentEntry(id);
}

/** Removes an entry and its join-table relations while preserving child pages as top-level entries. */
export async function deleteContentEntry(id: number) {
  const db = await requireDb();
  const existing = await getContentEntry(id);
  if (!existing) return false;
  await db.delete(contentCategories).where(eq(contentCategories.contentEntryId, id));
  await db.delete(contentTags).where(eq(contentTags.contentEntryId, id));
  await db.update(contentEntries).set({ parentId: null }).where(eq(contentEntries.parentId, id));
  await db.delete(contentEntries).where(eq(contentEntries.id, id));
  return true;
}

export async function getContentEntry(id: number) {
  const db = await requireDb();
  const entry = (await db.select().from(contentEntries).where(eq(contentEntries.id, id)).limit(1))[0] ?? null;
  if (!entry) return null;
  return hydrateEntry(entry);
}

export async function getContentEntryBySlug(contentTypeKey: string, slug: string, includeUnpublished = false) {
  const db = await requireDb();
  const contentType = await getContentTypeByKey(contentTypeKey);
  if (!contentType) return null;
  const conditions = [eq(contentEntries.contentTypeId, contentType.id), eq(contentEntries.slug, slug)];
  if (!includeUnpublished) conditions.push(eq(contentEntries.status, "published"));
  const entry = (await db.select().from(contentEntries).where(and(...conditions)).limit(1))[0] ?? null;
  return entry ? hydrateEntry(entry) : null;
}

export async function listContentEntries(options: {
  contentTypeKey: string;
  status?: CreateContentInput["status"];
  query?: string;
  page?: number;
  perPage?: number;
  publishedOnly?: boolean;
}) {
  const db = await requireDb();
  const contentType = await getContentTypeByKey(options.contentTypeKey);
  if (!contentType) return { entries: [], total: 0 };
  const conditions = [eq(contentEntries.contentTypeId, contentType.id)];
  if (options.status) conditions.push(eq(contentEntries.status, options.status));
  if (options.publishedOnly) conditions.push(eq(contentEntries.status, "published"));
  if (options.query) {
    const pattern = `%${options.query.trim()}%`;
    conditions.push(or(like(contentEntries.title, pattern), like(contentEntries.excerpt, pattern))!);
  }
  const page = Math.max(1, options.page ?? 1);
  const perPage = Math.min(100, Math.max(1, options.perPage ?? 12));
  const rows = await db
    .select()
    .from(contentEntries)
    .where(and(...conditions))
    .orderBy(desc(contentEntries.publishedAt), desc(contentEntries.updatedAt))
    .limit(perPage)
    .offset((page - 1) * perPage);
  return { entries: await Promise.all(rows.map(hydrateEntry)), total: rows.length };
}

async function hydrateEntry(entry: typeof contentEntries.$inferSelect) {
  const db = await requireDb();
  const [entryCategories, entryTags] = await Promise.all([
    db
      .select({ id: categories.id, name: categories.name, slug: categories.slug })
      .from(contentCategories)
      .innerJoin(categories, eq(contentCategories.categoryId, categories.id))
      .where(eq(contentCategories.contentEntryId, entry.id)),
    db
      .select({ id: tags.id, name: tags.name, slug: tags.slug })
      .from(contentTags)
      .innerJoin(tags, eq(contentTags.tagId, tags.id))
      .where(eq(contentTags.contentEntryId, entry.id)),
  ]);
  return { ...entry, categories: entryCategories, tags: entryTags };
}

async function replaceEntryTaxonomies(contentEntryId: number, categoryIds: number[], tagIds: number[]) {
  const db = await requireDb();
  await db.delete(contentCategories).where(eq(contentCategories.contentEntryId, contentEntryId));
  await db.delete(contentTags).where(eq(contentTags.contentEntryId, contentEntryId));
  if (categoryIds.length) {
    await db.insert(contentCategories).values(categoryIds.map(categoryId => ({ contentEntryId, categoryId })));
  }
  if (tagIds.length) {
    await db.insert(contentTags).values(tagIds.map(tagId => ({ contentEntryId, tagId })));
  }
}

export async function listCategories() {
  const db = await requireDb();
  return db.select().from(categories).orderBy(categories.name);
}

export async function createCategory(input: { name: string; slug: string; description?: string | null; parentId?: number | null }) {
  const db = await requireDb();
  const result = await db.insert(categories).values(input);
  return (await db.select().from(categories).where(eq(categories.id, Number(result[0].insertId))).limit(1))[0] ?? null;
}

export async function updateCategory(id: number, input: Partial<{ name: string; slug: string; description: string | null; parentId: number | null }>) {
  const db = await requireDb();
  await db.update(categories).set(input).where(eq(categories.id, id));
  return (await db.select().from(categories).where(eq(categories.id, id)).limit(1))[0] ?? null;
}

export async function deleteCategory(id: number) {
  const db = await requireDb();
  await db.update(categories).set({ parentId: null }).where(eq(categories.parentId, id));
  await db.delete(contentCategories).where(eq(contentCategories.categoryId, id));
  await db.delete(categories).where(eq(categories.id, id));
}

export async function listTags() {
  const db = await requireDb();
  return db.select().from(tags).orderBy(tags.name);
}

export async function createTag(input: { name: string; slug: string; description?: string | null }) {
  const db = await requireDb();
  const result = await db.insert(tags).values(input);
  return (await db.select().from(tags).where(eq(tags.id, Number(result[0].insertId))).limit(1))[0] ?? null;
}

export async function updateTag(id: number, input: Partial<{ name: string; slug: string; description: string | null }>) {
  const db = await requireDb();
  await db.update(tags).set(input).where(eq(tags.id, id));
  return (await db.select().from(tags).where(eq(tags.id, id)).limit(1))[0] ?? null;
}

export async function deleteTag(id: number) {
  const db = await requireDb();
  await db.delete(contentTags).where(eq(contentTags.tagId, id));
  await db.delete(tags).where(eq(tags.id, id));
}

export async function listMedia(options: { query?: string; page?: number; perPage?: number } = {}) {
  const db = await requireDb();
  const page = Math.max(1, options.page ?? 1);
  const perPage = Math.min(100, Math.max(1, options.perPage ?? 30));
  const condition = options.query ? like(media.fileName, `%${options.query.trim()}%`) : undefined;
  return db
    .select()
    .from(media)
    .where(condition)
    .orderBy(desc(media.createdAt))
    .limit(perPage)
    .offset((page - 1) * perPage);
}

export async function createMediaRecord(input: {
  storageKey: string;
  storageProvider: string;
  url: string;
  fileName: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  altText?: string | null;
  title?: string | null;
  caption?: string | null;
  description?: string | null;
  uploadedById: number;
}) {
  const db = await requireDb();
  const result = await db.insert(media).values(input);
  return (await db.select().from(media).where(eq(media.id, Number(result[0].insertId))).limit(1))[0] ?? null;
}

export async function getMediaRecord(id: number) {
  const db = await requireDb();
  return (await db.select().from(media).where(eq(media.id, id)).limit(1))[0] ?? null;
}

export async function updateMediaRecord(
  id: number,
  input: Partial<
    Pick<
      typeof media.$inferInsert,
      | "storageKey"
      | "storageProvider"
      | "url"
      | "fileName"
      | "originalFileName"
      | "mimeType"
      | "sizeBytes"
      | "altText"
      | "title"
      | "caption"
      | "description"
    >
  >,
) {
  const db = await requireDb();
  await db.update(media).set(input).where(eq(media.id, id));
  return (await db.select().from(media).where(eq(media.id, id)).limit(1))[0] ?? null;
}

export async function deleteMediaRecord(id: number) {
  const db = await requireDb();
  await db.delete(media).where(eq(media.id, id));
}

export async function getSettings(namespace = "site", publicOnly = false) {
  const db = await requireDb();
  const conditions = [eq(siteSettings.namespace, namespace)];
  if (publicOnly) conditions.push(eq(siteSettings.isPublic, true));
  const rows = await db.select().from(siteSettings).where(and(...conditions));
  return Object.fromEntries(rows.map(row => [row.key, row.value]));
}

export async function setSettings(
  values: Array<{ key: string; value: unknown; isPublic: boolean }>,
  updatedById: number,
  namespace = "site",
) {
  const db = await requireDb();
  for (const value of values) {
    await db
      .insert(siteSettings)
      .values({ namespace, ...value, updatedById })
      .onDuplicateKeyUpdate({ set: { value: value.value, isPublic: value.isPublic, updatedById } });
  }
  return getSettings(namespace);
}

export async function createApiTokenRecord(input: {
  userId: number;
  name: string;
  tokenId: string;
  tokenHash: string;
  tokenPrefix: string;
  scopes: ApiTokenScope[];
  expiresAt?: Date | null;
}) {
  const db = await requireDb();
  const result = await db.insert(apiTokens).values(input);
  return (await db.select().from(apiTokens).where(eq(apiTokens.id, Number(result[0].insertId))).limit(1))[0] ?? null;
}

export async function listApiTokensForUser(userId: number) {
  const db = await requireDb();
  return db
    .select({
      id: apiTokens.id,
      name: apiTokens.name,
      tokenPrefix: apiTokens.tokenPrefix,
      scopes: apiTokens.scopes,
      expiresAt: apiTokens.expiresAt,
      lastUsedAt: apiTokens.lastUsedAt,
      revokedAt: apiTokens.revokedAt,
      createdAt: apiTokens.createdAt,
    })
    .from(apiTokens)
    .where(eq(apiTokens.userId, userId))
    .orderBy(desc(apiTokens.createdAt));
}

export async function getActiveApiToken(tokenId: string) {
  const db = await requireDb();
  return (
    (await db
      .select()
      .from(apiTokens)
      .where(and(eq(apiTokens.tokenId, tokenId), isNull(apiTokens.revokedAt)))
      .limit(1))[0] ?? null
  );
}

export async function revokeApiToken(id: number, userId: number) {
  const db = await requireDb();
  await db.update(apiTokens).set({ revokedAt: new Date() }).where(and(eq(apiTokens.id, id), eq(apiTokens.userId, userId)));
}

export async function touchApiToken(tokenId: string) {
  const db = await requireDb();
  await db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.tokenId, tokenId));
}

export async function usersByIds(ids: number[]) {
  const db = await requireDb();
  if (!ids.length) return [];
  return db.select().from(users).where(inArray(users.id, ids));
}
