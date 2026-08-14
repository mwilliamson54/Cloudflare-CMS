import { describe, expect, it } from "vitest";
import { can, requireEntryOwnership, requireRoleChangeAllowed, type CmsCapability } from "./permissions";

describe("CMS role policy", () => {
  it("enforces the WordPress-style role capability matrix", () => {
    const allCapabilities: CmsCapability[] = ["content:read", "content:write", "content:publish", "media:write", "taxonomy:write", "token:manage", "site:manage", "users:manage"];
    expect(allCapabilities.every(capability => can("admin", capability))).toBe(true);
    expect(["content:read", "content:write", "content:publish", "media:write", "taxonomy:write", "token:manage"].every(capability => can("editor", capability as CmsCapability))).toBe(true);
    expect(can("editor", "site:manage")).toBe(false);
    expect(can("editor", "users:manage")).toBe(false);
    expect(can("author", "content:publish")).toBe(true);
    expect(can("author", "taxonomy:write")).toBe(false);
    expect(can("contributor", "content:write")).toBe(true);
    expect(can("contributor", "content:publish")).toBe(false);
    expect(can("subscriber", "content:read")).toBe(true);
    expect(can("subscriber", "content:write")).toBe(false);
    expect(can("viewer", "content:read")).toBe(true);
    expect(allCapabilities.filter(capability => capability !== "content:read").every(capability => !can("viewer", capability))).toBe(true);
  });

  it("restricts author and contributor mutations to their own content", () => {
    const author = { id: 7, role: "author" } as any;
    const contributor = { id: 9, role: "contributor" } as any;
    expect(() => requireEntryOwnership(author, { authorId: 7 })).not.toThrow();
    expect(() => requireEntryOwnership(contributor, { authorId: 9 })).not.toThrow();
    expect(() => requireEntryOwnership(author, { authorId: 8 })).toThrow(/only manage content/i);
    expect(() => requireEntryOwnership(contributor, { authorId: 8 })).toThrow(/only manage content/i);
  });

  it("blocks non-admin role changes and prevents administrator self-demotion", () => {
    const admin = { id: 1, role: "admin" } as any;
    const editor = { id: 2, role: "editor" } as any;
    expect(() => requireRoleChangeAllowed(editor, { id: 3, role: "author" } as any, "subscriber")).toThrow(/not permitted/i);
    expect(() => requireRoleChangeAllowed(admin, { id: 1, role: "admin" } as any, "editor")).toThrow(/cannot remove your own/i);
    expect(() => requireRoleChangeAllowed(admin, { id: 2, role: "editor" } as any, "author")).not.toThrow();
  });
});
