import { describe, expect, it } from "vitest";
import { appRouter } from "../functions/api/trpc/[[path]]";
import { sha256 } from "../functions/_shared/auth";

function makeEnv(role: string) {
  const menus: Record<string, unknown>[] = [];
  const session = {
    id: "session-1",
    user_id: 1,
    token_hash: "",
    csrf_token_hash: "",
    expires_at: new Date(Date.now() + 60_000).toISOString(),
    revoked_at: null,
  };
  const db = {
    prepare(query: string) {
      const all = async <T>() => ({ results: menus as T[] });
      return {
        all,
        bind(...values: unknown[]) {
          return {
            async first<T>() {
              if (query.includes("SELECT s.id")) {
                return { ...session, email: "admin@example.com", name: "Admin", role } as T;
              }
              if (query.includes("SELECT id,name,location,items") && query.includes("WHERE location")) {
                const menu = menus.find(item => item.location === values[0]);
                return (menu ? { ...menu } : null) as T;
              }
              return null;
            },
            async all<T>() {
              return { results: menus as T[] };
            },
            async run() {
              if (query.startsWith("INSERT INTO menus")) {
                const existing = menus.find(item => item.location === values[1]);
                if (existing) {
                  existing.name = values[0];
                  existing.items = values[2];
                  existing.updated_at = values[4];
                } else {
                  menus.push({ id: 1, name: values[0], location: values[1], items: values[2], created_at: values[3], updated_at: values[4] });
                }
              }
              return { meta: { last_row_id: 1 } };
            },
          };
        },
      };
    },
  };
  return { env: { CMS_DB: db }, session };
}

function callerFor(env: { CMS_DB: unknown }, session: { token_hash: string; csrf_token_hash: string }) {
  return appRouter.createCaller({
    env,
    request: new Request("https://cms.example/api/trpc", {
      headers: { cookie: "cms_session=session; cms_csrf_token=csrf", "x-csrf-token": "csrf" },
    }),
  } as never);
}

describe("Cloudflare D1 menu adapter", () => {
  it("saves and lists a menu for an administrator", async () => {
    const { env, session } = makeEnv("admin");
    session.token_hash = await sha256("session");
    session.csrf_token_hash = await sha256("csrf");
    const caller = callerFor(env, session);
    const saved = await caller.cms.menus.save({ name: "Header", location: "header", items: [{ id: "home", label: "Home", target: "url", url: "/" }] });
    expect(saved?.location).toBe("header");
    await expect(caller.cms.menus.list()).resolves.toHaveLength(1);
  });

  it("denies menu saves to editors", async () => {
    const { env, session } = makeEnv("editor");
    session.token_hash = await sha256("session");
    session.csrf_token_hash = await sha256("csrf");
    const caller = callerFor(env, session);
    await expect(caller.cms.menus.save({ name: "Header", location: "header", items: [] })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
