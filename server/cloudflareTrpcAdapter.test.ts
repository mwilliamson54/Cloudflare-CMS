import { describe, expect, it } from "vitest";
import { onRequest } from "../functions/api/trpc/[[path]]";
import { sha256 } from "../functions/_shared/auth";

function makeEnv() {
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
                return null;
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

function trpcRequest(path: string, request: Request) {
  return onRequest({ request, env: makeEnv().env, params: { path: path.split("/") } });
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

  it("enforces the double-submit CSRF contract and clears cookies on logout", async () => {
    const { env, sessions } = makeEnv();
    const sessionToken = "session-token";
    const csrfToken = "csrf-token";
    sessions.push({ id: "session-1", user_id: 1, token_hash: await sha256(sessionToken), csrf_token_hash: await sha256(csrfToken), expires_at: new Date(Date.now() + 60_000).toISOString(), revoked_at: null });
    const missingCsrf = await onRequest({ env, params: { path: ["auth", "logout"] }, request: new Request("https://cms.example/api/trpc/auth.logout", { method: "POST", headers: { cookie: `cms_session=${sessionToken}`, "content-type": "application/json" }, }) });
    expect(missingCsrf.status).toBe(403);
    const logout = await onRequest({ env, params: { path: ["auth", "logout"] }, request: new Request("https://cms.example/api/trpc/auth.logout", { method: "POST", headers: { cookie: `cms_session=${sessionToken}; cms_csrf_token=${csrfToken}`, "x-csrf-token": csrfToken, "content-type": "application/json" } }) });
    expect(logout.status).toBe(200);
    expect(logout.headers.get("set-cookie")).toContain("cms_session=");
    expect(sessions[0].revoked_at).toBeTruthy();
  });
});
