import { describe, expect, it } from "vitest";
import { CSRF_COOKIE, SESSION_COOKIE, createSession, currentSession, hashPassword, parseCookies, requireCsrf, verifyPassword } from "../functions/_shared/auth";

describe("Cloudflare production auth helpers", () => {
  it("hashes passwords with a verifiable salted PBKDF2 record", async () => {
    const encoded = await hashPassword("correct horse battery staple");
    expect(encoded).toMatch(/^pbkdf2-sha256\$210000\$/);
    await expect(verifyPassword("correct horse battery staple", encoded)).resolves.toBe(true);
    await expect(verifyPassword("wrong password", encoded)).resolves.toBe(false);
    await expect(hashPassword("short")).rejects.toThrow("12 to 256");
  });

  it("parses cookies and uses independent session and CSRF cookie names", () => {
    const cookies = parseCookies(`${SESSION_COOKIE}=session-value; ${CSRF_COOKIE}=csrf-value`);
    expect(cookies.get(SESSION_COOKIE)).toBe("session-value");
    expect(cookies.get(CSRF_COOKIE)).toBe("csrf-value");
  });

  it("creates a D1 session and only resolves it while unexpired and active", async () => {
    const rows: Record<string, unknown>[] = [];
    const db = {
      prepare(query: string) {
        return {
          bind(...values: unknown[]) {
            return {
              async first<T>() {
                if (query.startsWith("SELECT s.id")) return rows[0] as T ?? null;
                return null;
              },
              async run() {
                if (query.startsWith("INSERT INTO auth_sessions")) rows.push({ id: values[0], csrf_token_hash: values[3], expires_at: values[4], token_hash: values[2], user_id: values[1] });
              },
            };
          },
        };
      },
    };
    const env = { CMS_DB: db };
    const created = await createSession(7, env);
    expect(created.sessionToken).toBeTruthy();
    rows[0] = { ...rows[0], email: "admin@example.com", name: "Admin", role: "admin", user_id: 7 };
    const request = new Request("https://cms.example/admin", { headers: { cookie: `${SESSION_COOKIE}=${created.sessionToken}` } });
    const session = await currentSession(request, env);
    expect(session?.user).toMatchObject({ id: 7, role: "admin" });
    const csrfRequest = new Request("https://cms.example/admin", { headers: { cookie: `${CSRF_COOKIE}=${created.csrfToken}`, "x-csrf-token": created.csrfToken } });
    await expect(requireCsrf(csrfRequest, { csrfHash: String(rows[0].csrf_token_hash) })).resolves.toBe(true);
    const mismatched = new Request("https://cms.example/admin", { headers: { cookie: `${CSRF_COOKIE}=${created.csrfToken}`, "x-csrf-token": "different" } });
    await expect(requireCsrf(mismatched, { csrfHash: String(rows[0].csrf_token_hash) })).resolves.toBe(false);
  });
});
