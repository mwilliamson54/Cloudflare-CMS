import type { Request, Response } from "express";
import type { SsrPrefetch } from "../../client/src/ssr/prefetch";
import { appRouter } from "../routers";
import { createContext } from "./context";

/** Explicit public-only allowlist for data that may be dehydrated into SSR HTML. */
export async function buildSsrPrefetch(req: Request, res: Response): Promise<SsrPrefetch> {
  const context = await createContext({ req, res } as any);
  const caller = appRouter.createCaller(context);
  return {
    settings: () => caller.site.settings(),
    menus: () => caller.site.menus(),
    posts: input => caller.site.posts(input),
    post: slug => caller.site.post({ slug }),
    page: slug => caller.site.page({ slug }),
    categoryPosts: slug => caller.site.categoryPosts({ slug }),
    tagPosts: slug => caller.site.tagPosts({ slug }),
  };
}
