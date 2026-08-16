import { describe, expect, it } from "vitest";
import { onRequest } from "../functions/api/trpc/[[path]]";
import { sha256 } from "../functions/_shared/auth";

function makeEnv(mediaRows: Record<string, unknown>[] = []) {
  const users = [{ id: 1, email: "admin@example.com", name: "Admin", role: "admin" }];
  const sessions: Record<string, unknown>[] = [];
  const env = {
    CMS_DB: {
      prepare(query: string) {
        return {
          bind(...values: unknown[]) {
            return {
              async first<T>() {
                if (query.includes("SELECT s.id")) {
                  const row = sessions.find(item => item.token_hash === values[0] && !item.revoked_at);
                  if (!row) return null;
                  const user = users.find(item => item.id === row.user_id);
                  return { ...row, user_id: user?.id, email: user?.email, name: user?.name, role: user?.role } as T;
                }
                if (query.startsWith("SELECT COUNT(*) AS total FROM media")) return { total: mediaRows.length } as T;
                return null;
              },
              async all<T>() {
                if (query.startsWith("SELECT * FROM media")) return { results: mediaRows } as { results: T[] };
                return { results: [] as T[] };
              },
              async run() {
                if (query.startsWith("UPDATE auth_sessions")) {
                  const row = sessions.find(item => item.id === values[1]);
                  if (row) row.revoked_at = values[0];
                }
              },
            };
          },
        };
      },
    },
  };
  return { env, sessions };
}

describe("Cloudflare tRPC adapter auth boundary", () => {
  it("returns null for anonymous auth.me", async () => {
    const { env } = makeEnv();
    const response = await onRequest({ env, params: { path: ["auth", "me"] }, request: new Request("https://cms.example/api/trpc/auth.me") });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ result: { data: { json: null } } });
  });

  it("rejects protected mutations without a production session", async () => {
    const { env } = makeEnv();
    const response = await onRequest({ env, params: { path: ["cms", "content", "create"] }, request: new Request("https://cms.example/api/trpc/cms.content.create", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ json: {} }) }) });
    expect(response.status).toBe(401);
  });

  it("returns media list results as an array for the dashboard client", async () => {
    const { env, sessions } = makeEnv([{ id: 7, storage_key: "uploads/test.png", url: "/media/uploads/test.png", file_name: "test.png", original_file_name: "test.png", mime_type: "image/png", size_bytes: 12, uploaded_by_id: 1, alt_text: null, title: null }]);
    const sessionToken = "media-session";
    sessions.push({ id: "session-1", user_id: 1, token_hash: await sha256(sessionToken), csrf_token_hash: "unused", expires_at: new Date(Date.now() + 60_000).toISOString(), revoked_at: null });
    const response = await onRequest({ env, params: { path: ["cms", "media", "list"] }, request: new Request("https://cms.example/api/trpc/cms.media.list", { headers: { cookie: `cms_session=${sessionToken}` } }) });
    expect(response.status).toBe(200);
    const payload = await response.json() as { result?: { data?: { json?: unknown } } };
    const item = (payload.result?.data?.json as Array<Record<string, unknown>>)[0];
    expect(item.id).toBe(7);
    expect(item.storageKey).toBe("uploads/test.png");
    expect(item.sourceUrl).toBe("/media/uploads/test.png");
    expect(item.fileName).toBe("test.png");
    expect(item.mimeType).toBe("image/png");
    expect(item.sizeBytes).toBe(12);
  });

  it("enforces the double-submit CSRF contract and clears cookies on logout", async () => {
    const { env, sessions } = makeEnv();
    const sessionToken = "session-token";
    const csrfToken = "csrf-token";
    sessions.push({ id: "session-1", user_id: 1, token_hash: await sha256(sessionToken), csrf_token_hash: await sha256(csrfToken), expires_at: new Date(Date.now() + 60_000).toISOString(), revoked_at: null });
    const missingCsrf = await onRequest({ env, params: { path: ["auth", "logout"] }, request: new Request("https://cms.example/api/trpc/auth.logout", { method: "POST", headers: { cookie: `cms_session=${sessionToken}`, "content-type": "application/json" } }) });
    expect(missingCsrf.status).toBe(403);
    const logout = await onRequest({ env, params: { path: ["auth", "logout"] }, request: new Request("https://cms.example/api/trpc/auth.logout", { method: "POST", headers: { cookie: `cms_session=${sessionToken}; cms_csrf_token=${csrfToken}`, "x-csrf-token": csrfToken, "content-type": "application/json" } }) });
    expect(logout.status).toBe(200);
    expect(logout.headers.get("set-cookie")).toContain("cms_session=");
    expect(sessions[0].revoked_at).toBeTruthy();
  });
});

