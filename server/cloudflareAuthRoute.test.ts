import { describe, expect, it } from "vitest";
import { onRequest } from "../functions/api/auth/[[path]]";

type Row = Record<string, unknown>;

function makeEnv() {
  const users: Row[] = [];
  const sessions: Row[] = [];
  const env = {
    CMS_AUTH_BOOTSTRAP_SECRET: "one-time-bootstrap-secret",
    CMS_DB: {
      prepare(query: string) {
        return {
          bind(...values: unknown[]) {
            return {
              async first<T>() {
                if (query.includes("SELECT id,email FROM users WHERE role='admin'")) return (users.find(user => user.role === "admin") ?? null) as T;
                if (query.includes("SELECT id FROM users WHERE role='admin'")) return (users.find(user => user.role === "admin") ?? null) as T;
                if (query.includes("SELECT id,email,name,role,password_hash FROM users")) return (users.find(user => String(user.email).toLowerCase() === String(values[0]).toLowerCase()) ?? null) as T;
                if (query.includes("SELECT s.id")) {
                  const session = sessions.find(item => item.token_hash === values[0] && !item.revoked_at && String(item.expires_at) > String(values[1]));
                  if (!session) return null;
                  const user = users.find(item => item.id === session.user_id);
                  return { ...session, user_id: user?.id, email: user?.email, name: user?.name, role: user?.role } as T;
                }
                return null;
              },
              async run() {
                if (query.startsWith("INSERT INTO users")) users.push({ id: users.length + 1, email: values[0], name: values[1], password_hash: values[2], role: "admin" });
                if (query.startsWith("INSERT INTO auth_sessions")) sessions.push({ id: values[0], user_id: values[1], token_hash: values[2], csrf_token_hash: values[3], expires_at: values[4], revoked_at: null });
                if (query.startsWith("UPDATE auth_sessions")) {
                  const session = sessions.find(item => item.id === values[0]);
                  if (session) session.revoked_at = new Date().toISOString();
                }
                if (query.startsWith("UPDATE users SET password_hash=? WHERE lower(email)=?")) {
                  const user = users.find(item => String(item.email).toLowerCase() === String(values[1]).toLowerCase());
                  if (user) user.password_hash = values[0];
                }
              },
            };
          },
        };
      },
    },
  };
  return env;
}

const context = (env: ReturnType<typeof makeEnv>, path: string, request: Request) => ({ env, request, params: { path: path.split("/") } });
const jsonRequest = (url: string, method: string, body: unknown, headers: Record<string, string> = {}) => new Request(url, { method, headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

async function body(response: Response) { return response.json() as Promise<Record<string, unknown>>; }

function cookiePair(response: Response) {
  const values = response.headers.getSetCookie?.() ?? [];
  const session = values.find(value => value.startsWith("cms_session="))?.split(";", 1)[0] ?? "";
  const csrf = values.find(value => value.startsWith("cms_csrf_token="))?.split(";", 1)[0] ?? "";
  return { cookie: `${session}; ${csrf}`, csrf: decodeURIComponent(csrf.split("=", 2)[1] ?? "") };
}

describe("Cloudflare production auth routes", () => {
  it("initializes the password for the explicitly matched existing administrator", async () => {
    const env = makeEnv();
    const first = await onRequest(context(env, "bootstrap", jsonRequest("https://cms.example/api/auth/bootstrap", "POST", { bootstrapSecret: "one-time-bootstrap-secret", email: "admin@example.com", name: "Admin", password: "correct horse battery staple" })) as never);
    expect(first.status).toBe(201);
    const reset = await onRequest(context(env, "bootstrap", jsonRequest("https://cms.example/api/auth/bootstrap", "POST", { bootstrapSecret: "one-time-bootstrap-secret", email: "admin@example.com", name: "Admin Updated", password: "another correct password" })) as never);
    expect(reset.status).toBe(200);
    const login = await onRequest(context(env, "login", jsonRequest("https://cms.example/api/auth/login", "POST", { email: "admin@example.com", password: "another correct password" })) as never);
    expect(login.status).toBe(200);
    const rejectedOther = await onRequest(context(env, "bootstrap", jsonRequest("https://cms.example/api/auth/bootstrap", "POST", { bootstrapSecret: "one-time-bootstrap-secret", email: "other@example.com", password: "another correct password" })) as never);
    expect(rejectedOther.status).toBe(409);
  });

  it("bootstraps once, logs in, exposes the session, and requires CSRF on logout", async () => {
    const env = makeEnv();
    const bootstrapResponse = await onRequest(context(env, "bootstrap", jsonRequest("https://cms.example/api/auth/bootstrap", "POST", { bootstrapSecret: "one-time-bootstrap-secret", email: "admin@example.com", name: "Admin", password: "correct horse battery staple" })) as never);
    expect(bootstrapResponse.status).toBe(201);
    const secondBootstrap = await onRequest(context(env, "bootstrap", jsonRequest("https://cms.example/api/auth/bootstrap", "POST", { bootstrapSecret: "one-time-bootstrap-secret", email: "other@example.com", password: "another correct password" })) as never);
    expect(secondBootstrap.status).toBe(409);

    const loginResponse = await onRequest(context(env, "login", jsonRequest("https://cms.example/api/auth/login", "POST", { email: "admin@example.com", password: "correct horse battery staple" })) as never);
    expect(loginResponse.status).toBe(200);
    const auth = cookiePair(loginResponse);
    expect(auth.cookie).toContain("cms_session=");
    expect(auth.cookie).toContain("cms_csrf_token=");

    const meResponse = await onRequest(context(env, "me", new Request("https://cms.example/api/auth/me", { headers: { cookie: auth.cookie } })) as never);
    expect(meResponse.status).toBe(200);
    expect(await body(meResponse)).toMatchObject({ user: { email: "admin@example.com", role: "admin" } });

    const rejectedLogout = await onRequest(context(env, "logout", new Request("https://cms.example/api/auth/logout", { method: "POST", headers: { cookie: auth.cookie } })) as never);
    expect(rejectedLogout.status).toBe(403);
    const logout = await onRequest(context(env, "logout", new Request("https://cms.example/api/auth/logout", { method: "POST", headers: { cookie: auth.cookie, "x-csrf-token": auth.csrf } })) as never);
    expect(logout.status).toBe(200);
    const expiredMe = await onRequest(context(env, "me", new Request("https://cms.example/api/auth/me", { headers: { cookie: auth.cookie } })) as never);
    expect(expiredMe.status).toBe(401);
  });
});
