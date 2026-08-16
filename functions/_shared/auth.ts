export type AuthUser = {
  id: number;
  email: string | null;
  name: string | null;
  role: "admin" | "editor" | "author" | "contributor" | "subscriber" | "viewer";
};

type D1Statement = {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
};

export type AuthDb = {
  prepare(query: string): D1Statement;
};

export type AuthEnv = {
  CMS_DB: AuthDb;
  CMS_AUTH_BOOTSTRAP_SECRET?: string;
};

export const SESSION_COOKIE = "cms_session";
export const CSRF_COOKIE = "cms_csrf_token";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const PASSWORD_ITERATIONS = 210_000;
const encoder = new TextEncoder();

const bytesToBase64Url = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const base64UrlToBytes = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(normalized);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
};

const randomToken = (size = 32) => bytesToBase64Url(crypto.getRandomValues(new Uint8Array(size)));

export async function sha256(value: string) {
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

async function derivePassword(password: string, salt: Uint8Array, iterations = PASSWORD_ITERATIONS) {
  const material = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, material, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string) {
  if (password.length < 12 || password.length > 256) throw new Error("Password must contain 12 to 256 characters");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const digest = await derivePassword(password, salt);
  return `pbkdf2-sha256$${PASSWORD_ITERATIONS}$${bytesToBase64Url(salt)}$${bytesToBase64Url(digest)}`;
}

export async function verifyPassword(password: string, encoded: string | null | undefined) {
  if (!encoded?.startsWith("pbkdf2-sha256$")) return false;
  const [, iterationText, saltText, digestText] = encoded.split("$");
  const iterations = Number(iterationText);
  if (!Number.isSafeInteger(iterations) || iterations < 100_000 || iterations > 1_000_000 || !saltText || !digestText) return false;
  try {
    const expected = base64UrlToBytes(digestText);
    const actual = await derivePassword(password, base64UrlToBytes(saltText), iterations);
    if (expected.length !== actual.length) return false;
    let mismatch = 0;
    for (let index = 0; index < expected.length; index++) mismatch |= expected[index] ^ actual[index];
    return mismatch === 0;
  } catch {
    return false;
  }
}

export function parseCookies(header: string | null) {
  const cookies = new Map<string, string>();
  for (const part of header?.split(";") ?? []) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    cookies.set(part.slice(0, separator).trim(), decodeURIComponent(part.slice(separator + 1).trim()));
  }
  return cookies;
}

export function cookie(name: string, value: string, options: { httpOnly?: boolean; maxAge?: number } = {}) {
  const attributes = [`${name}=${encodeURIComponent(value)}`, "Path=/", "Secure", "SameSite=Lax"];
  if (options.httpOnly) attributes.push("HttpOnly");
  if (options.maxAge !== undefined) attributes.push(`Max-Age=${options.maxAge}`);
  return attributes.join("; ");
}

export function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export async function currentSession(request: Request, env: AuthEnv) {
  const token = parseCookies(request.headers.get("cookie")).get(SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const row = await env.CMS_DB.prepare("SELECT s.id,s.csrf_token_hash,s.expires_at,u.id AS user_id,u.email,u.name,u.role FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? LIMIT 1").bind(tokenHash, new Date().toISOString()).first<Record<string, string | number>>();
  if (!row) return null;
  return {
    sessionId: String(row.id),
    csrfHash: String(row.csrf_token_hash),
    user: { id: Number(row.user_id), email: row.email ? String(row.email) : null, name: row.name ? String(row.name) : null, role: String(row.role) as AuthUser["role"] },
  };
}

export async function createSession(userId: number, env: AuthEnv) {
  const sessionToken = randomToken();
  const csrfToken = randomToken(24);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await env.CMS_DB.prepare("INSERT INTO auth_sessions (id,user_id,token_hash,csrf_token_hash,expires_at) VALUES (?,?,?,?,?)").bind(randomToken(18), userId, await sha256(sessionToken), await sha256(csrfToken), expiresAt).run();
  return { sessionToken, csrfToken, expiresAt };
}

export async function requireCsrf(request: Request, session: { csrfHash: string }) {
  const cookieToken = parseCookies(request.headers.get("cookie")).get(CSRF_COOKIE);
  const headerToken = request.headers.get("x-csrf-token");
  if (!cookieToken || !headerToken || cookieToken !== headerToken) return false;
  return (await sha256(headerToken)) === session.csrfHash;
}

export function clearAuthCookies() {
  return [cookie(SESSION_COOKIE, "", { httpOnly: true, maxAge: 0 }), cookie(CSRF_COOKIE, "", { maxAge: 0 })];
}
