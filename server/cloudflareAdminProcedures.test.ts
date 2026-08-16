import { describe, expect, it } from "vitest";
import { verifyApiToken } from "./cms/apiTokens";
import { appRouter } from "../functions/api/trpc/[[path]]";
import { sha256 } from "../functions/_shared/auth";

const secret = "cloudflare-pages-jwt-secret-that-is-at-least-32-chars";

function makeEnv(role: string) {
  const issued: Record<string, unknown>[] = [];
  const session = { id: "session-1", user_id: 7, token_hash: "", csrf_token_hash: "", expires_at: new Date(Date.now() + 60_000).toISOString(), revoked_at: null };
  const db = {
    prepare(query: string) {
      return {
        async first<T>() {
          if (query.includes("SELECT s.id")) return { ...session, email: "writer@example.com", name: "Writer", role } as T;
          return null;
        },
        async all<T>() {
          if (query.includes("ct.key='post'")) return { results: [{ title: "Short", seo_description: null, excerpt: null, focus_keyword: null, body_markdown: "Brief", featured_media_id: null, canonical_url: null, robots_index: 1 }] as T[] };
          if (query.includes("content_types")) return { results: [{ id: 1, key: "post", label: "Posts", kind: "post", field_definitions: "[]", is_system: 1 }] as T[] };
          if (query.includes("themes")) return { results: [{ key: "fashion-editorial", name: "Fashion Editorial", is_active: 1 }] as T[] };
          if (query.includes("plugins")) return { results: [{ key: "reading-time", name: "Reading Time", is_active: 1 }] as T[] };
          if (query.includes("site_settings")) return { results: [{ key: "enabledPlugins", value: '["reading-time"]' }] as T[] };
          return { results: issued as T[] };
        },
        bind(...values: unknown[]) {
          return {
            async all<T>() {
              if (query.includes("ct.key='post'")) return { results: [{ title: "Short", seo_description: null, excerpt: null, focus_keyword: null, body_markdown: "Brief", featured_media_id: null, canonical_url: null, robots_index: 1 }] as T[] };
              return { results: issued as T[] };
            },
            async first<T>() {
              if (query.includes("SELECT s.id")) return { ...session, email: "writer@example.com", name: "Writer", role } as T;
              if (query.includes("COUNT(*)")) return { total: 1 } as T;
              if (query.includes("site_settings")) return { value: '["reading-time"]' } as T;
              return null;
            },
            async run() {
              if (query.includes("INSERT INTO api_tokens")) issued.push({ id: 1, token_hash: values[3], token_id: values[2], scopes: values[5] });
              return { meta: { last_row_id: 1, changes: 1 } };
            },
          };
        },
      };
    },
  };
  return { env: { CMS_DB: db, JWT_SECRET: secret }, session };
}

function callerFor(env: { CMS_DB: unknown; JWT_SECRET: string }) {
  return appRouter.createCaller({ env, request: new Request("https://cms.example/api/trpc", { headers: { cookie: "cms_session=session; cms_csrf_token=csrf", "x-csrf-token": "csrf" } }) } as never);
}

describe("Cloudflare admin procedures", () => {
  it("issues a D1-backed JWT token that the REST verifier accepts", async () => {
    const { env, session } = makeEnv("author");
    session.token_hash = await sha256("session"); session.csrf_token_hash = await sha256("csrf");
    const result = await callerFor(env).cms.apiTokens.create({ name: "Pages token", scopes: ["content:read"], expiresInDays: 7 });
    await expect(verifyApiToken(result.token, secret)).resolves.toMatchObject({ sub: "7", role: "author", scopes: ["content:read"], tokenId: result.tokenId });
  });

  it("matches dashboard parity for editor blocks, content types, and appearance", async () => {
    const { env, session } = makeEnv("admin"); session.token_hash = await sha256("session"); session.csrf_token_hash = await sha256("csrf");
    const caller = callerFor(env);
    await expect(caller.cms.editorBlocks()).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ type: "heading" })]));
    await expect(caller.cms.contentTypes.list()).resolves.toMatchObject([{ key: "post", isSystem: true }]);
    await expect(caller.cms.appearance.get()).resolves.toMatchObject({ activeTheme: "fashion-editorial", enabledPlugins: ["reading-time"] });
  });

  it("allows editor SEO summaries but denies contributors", async () => {
    const editor = makeEnv("editor"); editor.session.token_hash = await sha256("session"); editor.session.csrf_token_hash = await sha256("csrf");
    await expect(callerFor(editor.env).cms.seo.summary({ limit: 10 })).resolves.toMatchObject({ sampleSize: 1 });
    const contributor = makeEnv("contributor"); contributor.session.token_hash = await sha256("session"); contributor.session.csrf_token_hash = await sha256("csrf");
    await expect(callerFor(contributor.env).cms.seo.summary({ limit: 10 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
