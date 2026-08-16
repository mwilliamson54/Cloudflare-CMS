import { describe, expect, it } from "vitest";
import { appRouter } from "../functions/api/trpc/[[path]]";
import { sha256 } from "../functions/_shared/auth";

function makeEnv(role = "admin") {
  const rows: Record<string, unknown>[] = [];
  const sessions: Record<string, unknown>[] = [{ id: "session-1", user_id: 1, token_hash: "", csrf_token_hash: "", expires_at: new Date(Date.now() + 60_000).toISOString(), revoked_at: null }];
  const db = {
    prepare(query: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async first<T>() {
              if (query.includes("SELECT s.id")) return { ...sessions[0], user_id: 1, email: "admin@example.com", name: "Admin", role } as T;
              if (query.includes("SELECT id FROM content_types")) return { id: 1 } as T;
              if (query.includes("content_type_key") && query.includes("WHERE e.id=?")) return (rows.find(row => Number(row.id) === Number(values[0])) ?? null) as T;
              if (query.includes("SELECT author_id,trashed_at")) { const row = rows.find(item => Number(item.id) === Number(values[0])); return row ? { author_id: row.author_id, trashed_at: row.trashed_at } as T : null; }
              return null;
            },
            async all<T>() { return { results: rows as T[] }; },
            async run() {
              if (query.startsWith("INSERT INTO content_entries")) {
                rows.push({ id: 1, content_type_id: 1, content_type_key: "post", author_id: 1, title: values[2], slug: values[3], status: values[9], trashed_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), robots_index: 1, robots_follow: 1 });
                return { meta: { last_row_id: 1 } };
              }
              if (query.startsWith("UPDATE content_entries SET trashed_at")) { const row = rows[0]; row.trashed_at = values[0]; row.updated_at = values[1]; }
              if (query.startsWith("UPDATE content_entries SET trashed_at=NULL")) { rows[0].trashed_at = null; }
              return { meta: { last_row_id: 1 } };
            },
          };
        },
      };
    },
  };
  return { env: { CMS_DB: db }, rows, sessions };
}

function context(env: { CMS_DB: unknown }, sessionToken: string, csrfToken: string) {
  return { env, request: new Request("https://cms.example/api/trpc", { headers: { cookie: `cms_session=${sessionToken}; cms_csrf_token=${csrfToken}`, "x-csrf-token": csrfToken } }) } as never;
}

describe("Cloudflare D1 content adapter", () => {
  it("creates, trashes, and restores content through the D1 procedure boundary", async () => {
    const { env, sessions } = makeEnv();
    const sessionToken = "session";
    const csrfToken = "csrf";
    sessions[0].token_hash = await sha256(sessionToken);
    sessions[0].csrf_token_hash = await sha256(csrfToken);
    const caller = appRouter.createCaller(context(env, sessionToken, csrfToken));
    const created = await caller.cms.content.create({ contentTypeKey: "post", title: "Edge story", slug: "edge-story", status: "draft" });
    expect(created?.title).toBe("Edge story");
    const trashed = await caller.cms.content.trash({ id: 1 });
    expect(trashed.id).toBe(1);
    const restored = await caller.cms.content.restore({ id: 1 });
    expect(restored?.trashedAt).toBeNull();
  });

  it("denies publishing to contributors", async () => {
    const { env, sessions } = makeEnv("contributor");
    const sessionToken = "session";
    const csrfToken = "csrf";
    sessions[0].token_hash = await sha256(sessionToken);
    sessions[0].csrf_token_hash = await sha256(csrfToken);
    const caller = appRouter.createCaller(context(env, sessionToken, csrfToken));
    await expect(caller.cms.content.create({ contentTypeKey: "post", title: "Blocked", slug: "blocked", status: "published" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
