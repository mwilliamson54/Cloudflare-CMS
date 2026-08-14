import { describe, expect, it } from "vitest";
import { fashionTheme } from "../../client/src/themes/fashion/defaults";
import { BUNDLED_THEME_KEY, resolvePublicTheme, resolvePublicThemeFromSettings } from "../../client/src/themes/fashion/runtime";

describe("bundled single-theme runtime", () => {
  it("resolves the configured Fashion Editorial key to the bundled public theme", () => {
    expect(resolvePublicTheme(BUNDLED_THEME_KEY)).toBe(fashionTheme);
  });

  it("falls back to the bundled theme when deployment metadata is missing or unsupported", () => {
    expect(resolvePublicTheme(undefined)).toBe(fashionTheme);
    expect(resolvePublicTheme("unreviewed-theme")).toBe(fashionTheme);
  });

  it("gives public-shell consumers a safe persisted-settings resolver", () => {
    expect(resolvePublicThemeFromSettings({ theme: BUNDLED_THEME_KEY, siteTitle: "A custom title" })).toBe(fashionTheme);
    expect(resolvePublicThemeFromSettings({ theme: "unreviewed-theme" })).toBe(fashionTheme);
    expect(resolvePublicThemeFromSettings({ theme: { key: BUNDLED_THEME_KEY } })).toBe(fashionTheme);
    expect(resolvePublicThemeFromSettings(undefined)).toBe(fashionTheme);
  });
});
