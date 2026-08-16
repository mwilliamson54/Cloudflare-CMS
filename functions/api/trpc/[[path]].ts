import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { clearAuthCookies, currentSession, requireCsrf, type AuthEnv } from "../../_shared/auth";

type Context = { request: Request; env: AuthEnv & { CMS_DB: D1Database } };

const t = initTRPC.context<Context>().create();
const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  const session = await currentSession(ctx.request, ctx.env);
  if (!session) throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication required." });
  return next({ ctx: { ...ctx, session } });
});

const mutation = protectedProcedure.use(async ({ ctx, next }) => {
  const sessionId = ctx.session.sessionId;
  if (!(await requireCsrf(ctx.request, { csrfHash: ctx.session.csrfHash }))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "CSRF validation failed." });
  }
  return next({ ctx: { ...ctx, sessionId } });
});

const unsupported = () => {
  throw new TRPCError({
    code: "NOT_IMPLEMENTED",
    message: "This dashboard procedure is not yet available in the Cloudflare D1 adapter.",
  });
};

const appRouter = t.router({
  auth: t.router({
    me: t.procedure.query(async ({ ctx }) => (await currentSession(ctx.request, ctx.env))?.user ?? null),
    logout: mutation.mutation(async ({ ctx }) => {
      await ctx.env.CMS_DB.prepare("UPDATE auth_sessions SET revoked_at=? WHERE id=?").bind(new Date().toISOString(), ctx.sessionId).run();
      return { success: true } as const;
    }),
  }),
  cms: t.router({
    bootstrap: mutation.mutation(() => unsupported()),
    content: t.router({
      list: protectedProcedure.input(z.unknown()).query(() => unsupported()),
      get: protectedProcedure.input(z.unknown()).query(() => unsupported()),
      create: mutation.input(z.unknown()).mutation(() => unsupported()),
      update: mutation.input(z.unknown()).mutation(() => unsupported()),
      delete: mutation.input(z.unknown()).mutation(() => unsupported()),
      trash: mutation.input(z.unknown()).mutation(() => unsupported()),
      restore: mutation.input(z.unknown()).mutation(() => unsupported()),
    }),
  }),
});

export type CloudflareTrpcRouter = typeof appRouter;

export const onRequest = async (context: { request: Request; env: AuthEnv & { CMS_DB: D1Database }; params: { path?: string[] | string } }) => {
  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req: context.request,
    router: appRouter,
    createContext: () => ({ request: context.request, env: context.env }),
    onError({ error }) {
      console.error("Cloudflare tRPC error", error.message);
    },
  });
  const path = Array.isArray(context.params.path) ? context.params.path.join(".") : String(context.params.path ?? "");
  if (path === "auth.logout" && response.ok) {
    const headers = new Headers(response.headers);
    for (const value of clearAuthCookies()) headers.append("set-cookie", value);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
  return response;
};

export const onRequestPost = onRequest;
export const onRequestGet = onRequest;

