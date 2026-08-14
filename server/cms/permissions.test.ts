import { describe, expect, it } from "vitest";
import { can, type CmsCapability } from "./permissions";

describe("CMS role policy", () => {
  it("allows only the exact admin, editor, and viewer role capabilities", () => {
    const allCapabilities: CmsCapability[] = ["content:read", "content:write", "content:publish", "media:write", "taxonomy:write", "token:manage", "site:manage", "users:manage"];
    expect(allCapabilities.every(capability => can("admin", capability))).toBe(true);
    expect(["content:read", "content:write", "content:publish", "media:write", "taxonomy:write", "token:manage"].every(capability => can("editor", capability as CmsCapability))).toBe(true);
    expect(can("editor", "site:manage")).toBe(false);
    expect(can("editor", "users:manage")).toBe(false);
    expect(can("viewer", "content:read")).toBe(true);
    expect(allCapabilities.filter(capability => capability !== "content:read").every(capability => !can("viewer", capability))).toBe(true);
  });
});
