import { z } from "zod";
import { getContentEntryBySlug, getSettings, listCategories, listContentEntries, listMenus, listTags } from "../db";
import { publicProcedure, router } from "../_core/trpc";
import { cmsHooks } from "../cms/extensions";
import "../../plugins/registry";

export const siteRouter = router({
  posts: publicProcedure
    .input(z.object({ query: z.string().max(120).optional(), page: z.number().int().positive().optional(), perPage: z.number().int().positive().max(100).optional() }).optional())
    .query(async ({ input }) => {
      return listContentEntries({ contentTypeKey: "post", publishedOnly: true, ...input });
    }),
  post: publicProcedure.input(z.object({ slug: z.string().min(1).max(320) })).query(async ({ input }) => {
    const entry = await getContentEntryBySlug("post", input.slug);
    if (!entry) return null;
    const settings = await getSettings();
    const enabledPlugins = Array.isArray(settings.enabledPlugins) ? settings.enabledPlugins.filter((key): key is string => typeof key === "string") : [];
    const extension = await cmsHooks.applyFilters("post.public", { id: entry.id, title: entry.title, bodyMarkdown: entry.bodyMarkdown }, enabledPlugins);
    return { ...entry, readingTimeMinutes: extension.readingTimeMinutes };
  }),
  pages: publicProcedure.query(async () => {
    return listContentEntries({ contentTypeKey: "page", publishedOnly: true, perPage: 100 });
  }),
  page: publicProcedure.input(z.object({ slug: z.string().min(1).max(320) })).query(async ({ input }) => {
    return getContentEntryBySlug("page", input.slug);
  }),
  categories: publicProcedure.query(listCategories),
  tags: publicProcedure.query(listTags),
  settings: publicProcedure.query(async () => {
    return getSettings("site", true);
  }),
  menus: publicProcedure.query(async () => {
    return listMenus();
  }),
  categoryPosts: publicProcedure.input(z.object({ slug: z.string().min(1).max(180) })).query(async ({ input }) => {
    const result = await listContentEntries({ contentTypeKey: "post", publishedOnly: true, perPage: 100 });
    return result.entries.filter(entry => entry.categories.some(category => category.slug === input.slug));
  }),
  tagPosts: publicProcedure.input(z.object({ slug: z.string().min(1).max(180) })).query(async ({ input }) => {
    const result = await listContentEntries({ contentTypeKey: "post", publishedOnly: true, perPage: 100 });
    return result.entries.filter(entry => entry.tags.some(tag => tag.slug === input.slug));
  }),
});
