import express from "express";
import { afterEach, describe, expect, it } from "vitest";
import { COOKIE_NAME, CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "@shared/const";
import { trpcRequestGuard } from "./trpcGuard";

const servers: Array<ReturnType<ReturnType<typeof express>["listen"]>> = [];

async function request(headers: Record<string, string>, method: "GET" | "POST" = "POST") {
  const app = express();
  app.use(trpcRequestGuard);
  app.post("/write", (_req, res) => res.status(204).end());
  app.get("/write", (_req, res) => res.status(204).end());
  const server = app.listen(0);
  servers.push(server);
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected TCP listener");
  const url = `http://127.0.0.1:${address.port}/write`;
  const resolvedHeaders = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key, value === "$SELF" ? url.replace("/write", "") : value]));
  return fetch(url, { method, headers: resolvedHeaders });
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
});

describe("tRPC request guard", () => {
  const sessionCookie = `${COOKIE_NAME}=session; ${CSRF_COOKIE_NAME}=csrf-token`;

  it("allows a same-origin cookie-authenticated write with a matching CSRF header", async () => {
    const response = await request({ Origin: "$SELF", Cookie: sessionCookie, [CSRF_HEADER_NAME]: "csrf-token" });
    expect(response.status).toBe(204);
  });

  it("rejects cookie-authenticated writes with missing or invalid CSRF headers", async () => {
    const missing = await request({ Origin: "$SELF", Cookie: sessionCookie });
    const invalid = await request({ Origin: "$SELF", Cookie: sessionCookie, [CSRF_HEADER_NAME]: "wrong" });
    expect(missing.status).toBe(403);
    await expect(missing.json()).resolves.toEqual({ error: "Missing or invalid CSRF token." });
    expect(invalid.status).toBe(403);
  });

  it("rejects hostile-origin writes before reaching the route", async () => {
    const response = await request({ Origin: "https://attacker.example", Cookie: sessionCookie, [CSRF_HEADER_NAME]: "csrf-token" });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Cross-origin CMS requests are not allowed." });
  });

  it("allows same-origin cookie-authenticated read requests without a CSRF header", async () => {
    const response = await request({ Origin: "$SELF", Cookie: sessionCookie }, "GET");
    expect(response.status).toBe(204);
  });
});
