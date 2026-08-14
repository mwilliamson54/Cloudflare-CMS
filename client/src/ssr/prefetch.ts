import type { QueryClient } from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";
import { fallbackStories, fashionTheme } from "@/themes/fashion/runtime";
import { trpc } from "@/lib/trpc";

export type HeadMeta = {
  title: string;
  description: string;
  canonicalPath?: string;
  ogType?: "website" | "article";
  ogImage?: string;
  publishedTime?: string;
  modifiedTime?: string;
  noindex?: boolean;
  notFound?: boolean;
};

export type SsrPrefetch = {
  settings: () => Promise<Record<string, unknown>>;
  menus: () => Promise<unknown>;
  posts: (input?: { query?: string; page?: number; perPage?: number }) => Promise<any>;
  post: (slug: string) => Promise<any>;
  page: (slug: string) => Promise<any>;
  categoryPosts: (slug: string) => Promise<any>;
  tagPosts: (slug: string) => Promise<any>;
};

const DEFAULT_TITLE = "Atelier Journal — Fashion, culture, considered living";
const DEFAULT_DESCRIPTION = "An independent journal of fashion, culture, and considered living.";

function siteHead(settings: Record<string, unknown>) {
  const title = typeof settings.siteTitle === "string" ? settings.siteTitle : "Atelier Journal";
  const description = typeof settings.siteDescription === "string" ? settings.siteDescription : DEFAULT_DESCRIPTION;
  return { title, description };
}

function textTitle(value: string, site: string) { return value.trim() ? `${value} — ${site}` : site; }
async function seed(client: QueryClient, key: unknown, data: unknown) { client.setQueryData(key as any, data as any); }

export async function prefetchForPath(url: string, queryClient: QueryClient, p: SsrPrefetch): Promise<HeadMeta> {
  let path = url.split("?")[0] || "/";
  try { path = decodeURI(path); } catch { /* Preserve the raw path if malformed. */ }
  const cleanPath = path.replace(/\/+$/, "") || "/";
  const settings = await p.settings();
  const menus = await p.menus();
  await seed(queryClient, getQueryKey(trpc.site.settings, undefined, "query"), settings);
  await seed(queryClient, getQueryKey(trpc.site.menus, undefined, "query"), menus);
  const site = siteHead(settings);

  if (cleanPath === "/") {
    const posts = await p.posts({ perPage: 100 });
    await seed(queryClient, getQueryKey(trpc.site.posts, { perPage: 100 }, "query"), posts);
    return { title: DEFAULT_TITLE, description: site.description, canonicalPath: "/", ogImage: fashionTheme.images.hero };
  }
  if (cleanPath === "/blog") {
    const posts = await p.posts({ perPage: 30 });
    await seed(queryClient, getQueryKey(trpc.site.posts, { perPage: 30 }, "query"), posts);
    return { title: `Latest stories — ${site.title}`, description: DEFAULT_DESCRIPTION, canonicalPath: "/blog", ogImage: fashionTheme.images.hero };
  }
  const category = cleanPath.match(/^\/category\/([^/]+)$/);
  if (category) {
    const slug = category[1]; const posts = await p.categoryPosts(slug);
    await seed(queryClient, getQueryKey(trpc.site.categoryPosts, { slug }, "query"), posts);
    return { title: `${slug.replace(/-/g, " ")} — ${site.title}`, description: "Editorial stories by category.", canonicalPath: cleanPath, ogImage: fashionTheme.images.cardOne };
  }
  const tag = cleanPath.match(/^\/tag\/([^/]+)$/);
  if (tag) {
    const slug = tag[1]; const posts = await p.tagPosts(slug);
    await seed(queryClient, getQueryKey(trpc.site.tagPosts, { slug }, "query"), posts);
    return { title: `${slug.replace(/-/g, " ")} — ${site.title}`, description: "Editorial stories by tag.", canonicalPath: cleanPath, ogImage: fashionTheme.images.cardTwo };
  }
  const article = cleanPath.match(/^\/blog\/([^/]+)$/);
  if (article) {
    const slug = article[1]; const entry = await p.post(slug);
    if (!entry) {
      const fallback = fallbackStories.find(story => story.slug === slug);
      return fallback ? { title: textTitle(fallback.title, site.title), description: fallback.excerpt, canonicalPath: cleanPath, ogType: "article", ogImage: fallback.image } : { title: site.title, description: site.description, notFound: true };
    }
    await seed(queryClient, getQueryKey(trpc.site.post, { slug }, "query"), entry);
    return { title: entry.seoTitle || textTitle(entry.title, site.title), description: entry.seoDescription || entry.excerpt || DEFAULT_DESCRIPTION, canonicalPath: entry.canonicalUrl || cleanPath, ogType: "article", ogImage: fashionTheme.images.hero, publishedTime: entry.publishedAt ? new Date(entry.publishedAt).toISOString() : undefined, modifiedTime: entry.updatedAt ? new Date(entry.updatedAt).toISOString() : undefined, noindex: !entry.robotsIndex };
  }
  const page = cleanPath.match(/^\/page\/([^/]+)$/);
  if (page) {
    const slug = page[1]; const entry = await p.page(slug);
    if (!entry) return { title: site.title, description: site.description, notFound: true };
    await seed(queryClient, getQueryKey(trpc.site.page, { slug }, "query"), entry);
    return { title: entry.seoTitle || textTitle(entry.title, site.title), description: entry.seoDescription || entry.excerpt || DEFAULT_DESCRIPTION, canonicalPath: entry.canonicalUrl || cleanPath, ogImage: fashionTheme.images.hero, noindex: !entry.robotsIndex };
  }
  if (cleanPath === "/search") {
    const query = new URLSearchParams(url.slice(url.indexOf("?") + 1)).get("q") || "";
    if (query) {
      const posts = await p.posts({ query, perPage: 30 });
      await seed(queryClient, getQueryKey(trpc.site.posts, { query, perPage: 30 }, "query"), posts);
    }
    return { title: `Search — ${site.title}`, description: "Search results from Atelier Journal.", canonicalPath: "/search", noindex: true };
  }
  if (cleanPath === "/admin" || cleanPath.startsWith("/admin/") || cleanPath === "/preview" || cleanPath.startsWith("/preview/")) return { title: site.title, description: site.description, noindex: true };
  return { title: site.title, description: site.description, notFound: true };
}
