import { AuthEnv, AuthUser, CSRF_COOKIE, SESSION_COOKIE, clearAuthCookies, cookie, createSession, currentSession, hashPassword, json, parseCookies, requireCsrf, sha256, verifyPassword } from "../../_shared/auth";

type Context = { request: Request; env: AuthEnv; params: { path?: string[] | string } };

const pathSegments = (context: Context) => Array.isArray(context.params.path) ? context.params.path : context.params.path ? context.params.path.split("/") : [];
const methodNotAllowed = () => json({ code: "method_not_allowed", message: "Method not allowed" }, { status: 405, headers: { allow: "GET,POST" } });
const getBody = async (request: Request) => {
  try { return await request.json() as Record<string, unknown>; } catch { return null; }
};
const stringField = (body: Record<string, unknown> | null, key: string) => typeof body?.[key] === "string" ? body[key].trim() : "";
const publicUser = (user: AuthUser) => ({ id: user.id, email: user.email, name: user.name, role: user.role });

async function bootstrap(request: Request, env: AuthEnv) {
  if (!env.CMS_AUTH_BOOTSTRAP_SECRET) return json({ code: "bootstrap_disabled" }, { status: 404 });
  const body = await getBody(request);
  const suppliedSecret = stringField(body, "bootstrapSecret");
  if (!suppliedSecret || (await sha256(suppliedSecret)) !== (await sha256(env.CMS_AUTH_BOOTSTRAP_SECRET))) return json({ code: "forbidden" }, { status: 403 });
  const existingAdmin = await env.CMS_DB.prepare("SELECT id,email FROM users WHERE role='admin' LIMIT 1").bind().first<{ id: number; email?: string | null }>();
  const email = stringField(body, "email").toLowerCase();
  const name = stringField(body, "name") || "Administrator";
  const password = stringField(body, "password");
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 12) return json({ code: "invalid_input", message: "A valid email and a password of at least 12 characters are required" }, { status: 400 });
  const passwordHash = await hashPassword(password);
  if (existingAdmin) {
    if (String(existingAdmin.email ?? "").toLowerCase() !== email) return json({ code: "bootstrap_already_completed" }, { status: 409 });
    await env.CMS_DB.prepare("UPDATE users SET password_hash=? WHERE lower(email)=?").bind(passwordHash, email).run();
    return json({ ok: true, message: "Administrator password initialized. Remove CMS_AUTH_BOOTSTRAP_SECRET after use." });
  }
  try {
    await env.CMS_DB.prepare("INSERT INTO users (email,name,password_hash,role) VALUES (?,?,?,'admin')").bind(email, name.slice(0, 200), passwordHash).run();
  } catch {
    return json({ code: "bootstrap_failed" }, { status: 409 });
  }
  return json({ ok: true, message: "Administrator created. Remove CMS_AUTH_BOOTSTRAP_SECRET after first use." }, { status: 201 });
}

async function login(request: Request, env: AuthEnv) {
  const body = await getBody(request);
  const email = stringField(body, "email").toLowerCase();
  const password = stringField(body, "password");
  const user = await env.CMS_DB.prepare("SELECT id,email,name,role,password_hash FROM users WHERE lower(email)=? LIMIT 1").bind(email).first<Record<string, string | number | null>>();
  if (!user || !(await verifyPassword(password, user.password_hash ? String(user.password_hash) : null))) return json({ code: "invalid_credentials", message: "Invalid email or password" }, { status: 401 });
  const session = await createSession(Number(user.id), env);
  const response = json({ user: publicUser({ id: Number(user.id), email: user.email ? String(user.email) : null, name: user.name ? String(user.name) : null, role: String(user.role) as AuthUser["role"] }), expiresAt: session.expiresAt });
  response.headers.append("set-cookie", cookie(SESSION_COOKIE, session.sessionToken, { httpOnly: true, maxAge: 60 * 60 * 24 * 7 }));
  response.headers.append("set-cookie", cookie(CSRF_COOKIE, session.csrfToken, { maxAge: 60 * 60 * 24 * 7 }));
  return response;
}

export const onRequest = async (context: Context) => {
  const [resource] = pathSegments(context);
  if (context.request.method === "POST" && resource === "bootstrap") return bootstrap(context.request, context.env);
  if (context.request.method === "POST" && resource === "login") return login(context.request, context.env);
  const session = await currentSession(context.request, context.env);
  if (resource === "me" && context.request.method === "GET") return session ? json({ user: session.user }) : json({ user: null }, { status: 401 });
  if (resource === "logout" && context.request.method === "POST") {
    if (!session || !(await requireCsrf(context.request, session))) return json({ code: "csrf_failed" }, { status: 403 });
    await context.env.CMS_DB.prepare("UPDATE auth_sessions SET revoked_at=CURRENT_TIMESTAMP WHERE id=?").bind(session.sessionId).run();
    const response = json({ ok: true });
    for (const value of clearAuthCookies()) response.headers.append("set-cookie", value);
    return response;
  }
  return methodNotAllowed();
};
