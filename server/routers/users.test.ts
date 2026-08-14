import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

vi.mock("../db", async () => {
  const actual = await vi.importActual<typeof import("../db")>("../db");
  return {
    ...actual,
    getUserById: vi.fn(async (id: number) => ({
      id,
      openId: id === 1 ? "admin-test" : "user-test",
      name: "Test user",
      email: "test@example.com",
      loginMethod: "test",
      role: "admin" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    })),
    updateUserRole: vi.fn(),
  };
});

import { cmsRouter } from "./cms";

function context(role: "admin" | "editor" | "author" | "contributor" | "subscriber" | "viewer", id = 1): TrpcContext {
  return {
    user: { id, openId: `${role}-test`, name: role, email: `${role}@example.com`, loginMethod: "test", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("CMS user-role procedures", () => {
  it.each(["editor", "author", "contributor", "subscriber", "viewer"] as const)("rejects %s from listing or changing roles", async role => {
    const caller = cmsRouter.createCaller(context(role));
    await expect(caller.users.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.users.updateRole({ id: 2, role: "author" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("blocks an administrator from demoting their own account through the procedure", async () => {
    const caller = cmsRouter.createCaller(context("admin", 1));
    await expect(caller.users.updateRole({ id: 1, role: "editor" })).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringMatching(/cannot remove your own/i) });
  });
});
