import { fashionTheme } from "./defaults";

export const BUNDLED_THEME_KEY = "fashion-editorial" as const;

/**
 * Resolves the theme available in this initial CMS deployment. The persisted
 * setting remains deployment metadata until a reviewed multi-theme registry is
 * introduced, so malformed or future values always fall back safely.
 */
export function resolvePublicTheme(themeKey: unknown) {
  return themeKey === BUNDLED_THEME_KEY ? fashionTheme : fashionTheme;
}
