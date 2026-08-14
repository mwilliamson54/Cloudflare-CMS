import {
  bigint,
  boolean,
  datetime,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const roleValues = ["admin", "editor", "author", "contributor", "subscriber", "viewer"] as const;
export const contentStatusValues = ["draft", "scheduled", "published", "archived"] as const;
export const contentTypeKindValues = ["post", "page", "custom"] as const;

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", roleValues).default("subscriber").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const contentTypes = mysqlTable(
  "content_types",
  {
    id: int("id").autoincrement().primaryKey(),
    key: varchar("key", { length: 64 }).notNull(),
    label: varchar("label", { length: 120 }).notNull(),
    kind: mysqlEnum("kind", contentTypeKindValues).notNull(),
    description: text("description"),
    fieldDefinitions: json("fieldDefinitions").$type<ContentFieldDefinition[]>().notNull(),
    isSystem: boolean("isSystem").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("content_types_key_unique").on(table.key)],
);

export const media = mysqlTable(
  "media",
  {
    id: int("id").autoincrement().primaryKey(),
    storageKey: varchar("storageKey", { length: 512 }).notNull(),
    storageProvider: varchar("storageProvider", { length: 48 }).default("s3-compatible").notNull(),
    url: varchar("url", { length: 1024 }).notNull(),
    fileName: varchar("fileName", { length: 255 }).notNull(),
    originalFileName: varchar("originalFileName", { length: 255 }).notNull(),
    mimeType: varchar("mimeType", { length: 128 }).notNull(),
    sizeBytes: bigint("sizeBytes", { mode: "number" }).notNull(),
    width: int("width"),
    height: int("height"),
    altText: varchar("altText", { length: 500 }),
    title: varchar("title", { length: 255 }),
    caption: text("caption"),
    description: text("description"),
    uploadedById: int("uploadedById").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("media_storage_key_unique").on(table.storageKey),
    index("media_uploaded_by_index").on(table.uploadedById),
    index("media_mime_type_index").on(table.mimeType),
    index("media_created_at_index").on(table.createdAt),
  ],
);

export const contentEntries = mysqlTable(
  "content_entries",
  {
    id: int("id").autoincrement().primaryKey(),
    contentTypeId: int("contentTypeId").notNull(),
    authorId: int("authorId").notNull(),
    title: varchar("title", { length: 300 }).notNull(),
    slug: varchar("slug", { length: 320 }).notNull(),
    excerpt: text("excerpt"),
    bodyMarkdown: text("bodyMarkdown"),
    bodyHtml: text("bodyHtml"),
    fieldData: json("fieldData").$type<Record<string, unknown>>(),
    featuredMediaId: int("featuredMediaId"),
    parentId: int("parentId"),
    templateKey: varchar("templateKey", { length: 96 }).default("default").notNull(),
    status: mysqlEnum("status", contentStatusValues).default("draft").notNull(),
    scheduledAt: datetime("scheduledAt", { mode: "date" }),
    publishedAt: datetime("publishedAt", { mode: "date" }),
    archivedAt: datetime("archivedAt", { mode: "date" }),
    trashedAt: datetime("trashedAt", { mode: "date" }),
    seoTitle: varchar("seoTitle", { length: 300 }),
    seoDescription: varchar("seoDescription", { length: 500 }),
    focusKeyword: varchar("focusKeyword", { length: 120 }),
    canonicalUrl: varchar("canonicalUrl", { length: 1024 }),
    robotsIndex: boolean("robotsIndex").default(true).notNull(),
    robotsFollow: boolean("robotsFollow").default(true).notNull(),
    ogTitle: varchar("ogTitle", { length: 300 }),
    ogDescription: varchar("ogDescription", { length: 500 }),
    ogImageMediaId: int("ogImageMediaId"),
    schemaJson: json("schemaJson").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("content_entries_type_slug_unique").on(table.contentTypeId, table.slug),
    index("content_entries_status_published_index").on(table.status, table.publishedAt),
    index("content_entries_trashed_at_index").on(table.trashedAt),
    index("content_entries_author_index").on(table.authorId),
    index("content_entries_featured_media_index").on(table.featuredMediaId),
    index("content_entries_parent_index").on(table.parentId),
    index("content_entries_template_index").on(table.templateKey),
  ],
);

export const categories = mysqlTable(
  "categories",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 180 }).notNull(),
    description: text("description"),
    parentId: int("parentId"),
    seoTitle: varchar("seoTitle", { length: 300 }),
    seoDescription: varchar("seoDescription", { length: 500 }),
    robotsIndex: boolean("robotsIndex").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("categories_slug_unique").on(table.slug),
    index("categories_parent_index").on(table.parentId),
  ],
);

export const tags = mysqlTable(
  "tags",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 180 }).notNull(),
    description: text("description"),
    seoTitle: varchar("seoTitle", { length: 300 }),
    seoDescription: varchar("seoDescription", { length: 500 }),
    robotsIndex: boolean("robotsIndex").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("tags_slug_unique").on(table.slug)],
);

export const contentCategories = mysqlTable(
  "content_categories",
  {
    contentEntryId: int("contentEntryId").notNull(),
    categoryId: int("categoryId").notNull(),
  },
  table => [primaryKey({ columns: [table.contentEntryId, table.categoryId] })],
);

export const contentTags = mysqlTable(
  "content_tags",
  {
    contentEntryId: int("contentEntryId").notNull(),
    tagId: int("tagId").notNull(),
  },
  table => [primaryKey({ columns: [table.contentEntryId, table.tagId] })],
);

export const apiTokens = mysqlTable(
  "api_tokens",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    tokenId: varchar("tokenId", { length: 96 }).notNull(),
    tokenHash: varchar("tokenHash", { length: 128 }).notNull(),
    tokenPrefix: varchar("tokenPrefix", { length: 20 }).notNull(),
    scopes: json("scopes").$type<ApiTokenScope[]>().notNull(),
    expiresAt: datetime("expiresAt", { mode: "date" }),
    lastUsedAt: datetime("lastUsedAt", { mode: "date" }),
    revokedAt: datetime("revokedAt", { mode: "date" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("api_tokens_token_id_unique").on(table.tokenId),
    index("api_tokens_user_index").on(table.userId),
    index("api_tokens_active_index").on(table.revokedAt, table.expiresAt),
  ],
);

export const siteSettings = mysqlTable(
  "site_settings",
  {
    id: int("id").autoincrement().primaryKey(),
    key: varchar("key", { length: 160 }).notNull(),
    namespace: varchar("namespace", { length: 80 }).default("site").notNull(),
    value: json("value").$type<unknown>().notNull(),
    isPublic: boolean("isPublic").default(false).notNull(),
    updatedById: int("updatedById"),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("site_settings_namespace_key_unique").on(table.namespace, table.key)],
);

export const menus = mysqlTable(
  "menus",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    location: varchar("location", { length: 80 }).notNull(),
    items: json("items").$type<MenuItem[]>().notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("menus_location_unique").on(table.location)],
);

export const themes = mysqlTable(
  "themes",
  {
    id: int("id").autoincrement().primaryKey(),
    key: varchar("key", { length: 80 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    version: varchar("version", { length: 32 }).notNull(),
    settings: json("settings").$type<Record<string, unknown>>().notNull(),
    isActive: boolean("isActive").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("themes_key_unique").on(table.key)],
);

export const plugins = mysqlTable(
  "plugins",
  {
    id: int("id").autoincrement().primaryKey(),
    key: varchar("key", { length: 80 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    version: varchar("version", { length: 32 }).notNull(),
    settings: json("settings").$type<Record<string, unknown>>().notNull(),
    isActive: boolean("isActive").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("plugins_key_unique").on(table.key)],
);

export type ContentFieldDefinition = {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "date" | "boolean" | "select" | "media";
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
};

export type ApiTokenScope = "content:read" | "content:write" | "media:write" | "taxonomy:write";

export type MenuItem = {
  id: string;
  label: string;
  target: "page" | "post" | "category" | "url";
  targetId?: number;
  url?: string;
  children?: MenuItem[];
};

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type ContentEntry = typeof contentEntries.$inferSelect;
export type Media = typeof media.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Tag = typeof tags.$inferSelect;
