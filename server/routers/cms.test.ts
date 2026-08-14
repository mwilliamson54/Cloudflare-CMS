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
  it("blocks a viewer from all sensitive CMS mutation families", async () => {
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
    await expect(caller.content.delete({ id: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.bootstrap()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.menus.save({ name: "Restricted", location: "header", items: [{ id: "menu-1", label: "Home", target: "url", url: "/" }] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.media.update({ id: 1, values: { altText: "Restricted" } })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.categories.create({ name: "Restricted", slug: "restricted" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.settings.update({ siteTitle: "Restricted" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.appearance.update({ enabledPlugins: [] })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.users.updateRole({ id: 1, role: "author" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
