import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const repository = vi.hoisted(() => ({
  bootstrapCms: vi.fn(),
  getSettings: vi.fn(),
  listPlugins: vi.fn(),
  listThemes: vi.fn(),
  setSettings: vi.fn(),
  setBundledPluginActivation: vi.fn(),
}));

vi.mock("../db", async () => {
  const actual = await vi.importActual<typeof import("../db")>("../db");
  return { ...actual, ...repository };
});

import { cmsRouter } from "./cms";

function context(role: "admin" | "editor" | "viewer"): TrpcContext {
  return {
    user: { id: 8, openId: `${role}-appearance`, name: role, email: `${role}@example.com`, loginMethod: "test", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("CMS appearance configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repository.getSettings.mockResolvedValue({ theme: "fashion-editorial", enabledPlugins: ["reading-time"] });
    repository.listThemes.mockResolvedValue([{ id: 1, key: "fashion-editorial", name: "Fashion Editorial", version: "1.0.0", settings: { mode: "bundled-single-theme" }, isActive: true }]);
    repository.listPlugins.mockResolvedValue([{ id: 2, key: "reading-time", name: "Reading Time", version: "1.0.0", settings: { trusted: true }, isActive: true }]);
    repository.setSettings.mockResolvedValue({});
    repository.setBundledPluginActivation.mockResolvedValue([]);
  });

  it.each(["editor", "viewer"] as const)("rejects %s from reading or updating theme and plugin activation", async role => {
    const caller = cmsRouter.createCaller(context(role));
    await expect(caller.appearance.get()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.appearance.update({ enabledPlugins: [] })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("returns database-backed bundled appearance records and persists controlled administrator plugin activation", async () => {
    const caller = cmsRouter.createCaller(context("admin"));
    await expect(caller.appearance.get()).resolves.toMatchObject({ activeTheme: "fashion-editorial", themeMode: "bundled-single-theme", enabledPlugins: ["reading-time"], themes: [{ key: "fashion-editorial", isActive: true }], plugins: [{ key: "reading-time", isActive: true }] });
    await caller.appearance.update({ enabledPlugins: [] });

    expect(repository.setBundledPluginActivation).toHaveBeenCalledWith([]);
    expect(repository.setSettings).toHaveBeenCalledWith([
      { key: "enabledPlugins", value: [], isPublic: false },
    ], 8);
  });

  it("retains the reviewed Fashion Editorial theme as the only administrator-visible theme mode", async () => {
    const caller = cmsRouter.createCaller(context("admin"));

    await expect(caller.appearance.get()).resolves.toMatchObject({ activeTheme: "fashion-editorial", themeMode: "bundled-single-theme" });
  });

  it("rejects activation of unreviewed plugin keys", async () => {
    const caller = cmsRouter.createCaller(context("admin"));
    await expect(caller.appearance.update({ enabledPlugins: ["third-party-plugin"] as never[] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
