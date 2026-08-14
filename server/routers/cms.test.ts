import { describe, expect, it } from "vitest";
import type { TrpcContext } from "../_core/context";
import { cmsRouter } from "./cms";

function viewerContext(): TrpcContext {
  return {
    user: {
      id: 7,
      openId: "viewer-test",
      name: "Viewer",
      email: "viewer@example.com",
      loginMethod: "test",
      role: "viewer",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("CMS procedure authorization", () => {
  it("blocks a viewer from creating content and API tokens", async () => {
    const caller = cmsRouter.createCaller(viewerContext());

    await expect(
      caller.content.create({
        contentTypeKey: "post",
        title: "Restricted",
        slug: "restricted",
        status: "draft",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      caller.apiTokens.create({ name: "Restricted", scopes: ["content:read"], expiresInDays: 30 }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
