import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const repository = vi.hoisted(() => ({ setSettings: vi.fn() }));

vi.mock("../db", async () => ({ ...(await vi.importActual<typeof import("../db")>("../db")), ...repository }));

import { cmsRouter } from "./cms";

function context(role: "admin" | "editor" | "author" | "contributor" | "subscriber" | "viewer"): TrpcContext {
  return {
    user: { id: 1, openId: `${role}-1`, name: role, email: `${role}@example.com`, loginMethod: "test", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

const settingsInput = {
  siteTitle: "Atelier Journal",
  siteDescription: "An independent fashion journal.",
  siteIndexing: true,
  homepageCategorySlugs: ["fashion"],
  footerTagline: "Considered living.",
  footerLocation: "London",
  footerInstagramUrl: "https://www.instagram.com/atelier",
};

describe("CMS controlled custom CSS settings", () => {
  beforeEach(() => { vi.clearAllMocks(); repository.setSettings.mockResolvedValue({}); });

  it("persists accepted local CSS as a public setting", async () => {
    await cmsRouter.createCaller(context("admin")).settings.update({ ...settingsInput, customCss: ".site-accent { color: #a77150; }" });

    expect(repository.setSettings).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ key: "customCss", value: ".site-accent { color: #a77150; }", isPublic: true }),
    ]), 1);
  });

  it("rejects remote imports and does not persist unsafe CSS", async () => {
    await expect(cmsRouter.createCaller(context("admin")).settings.update({ ...settingsInput, customCss: '@import url("https://example.test/theme.css");' })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(repository.setSettings).not.toHaveBeenCalled();
  });

  it.each(["editor", "author", "contributor", "subscriber", "viewer"] as const)("rejects %s from mutating global site settings", async role => {
    await expect(cmsRouter.createCaller(context(role)).settings.update(settingsInput)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(repository.setSettings).not.toHaveBeenCalled();
  });
});
