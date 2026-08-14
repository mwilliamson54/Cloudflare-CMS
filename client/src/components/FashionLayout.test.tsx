import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fashionTheme } from "@/themes/fashion/defaults";
import { BUNDLED_THEME_KEY } from "@/themes/fashion/runtime";

const state = vi.hoisted(() => ({ settings: undefined as Record<string, unknown> | undefined }));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    site: {
      settings: { useQuery: () => ({ data: state.settings }) },
      menus: { useQuery: () => ({ data: [] }) },
    },
  },
}));

vi.mock("wouter", () => ({
  Link: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  useLocation: () => ["/", vi.fn()],
}));

import { FashionFooter, FashionHeader, Newsletter } from "./FashionLayout";

function renderPublicShell(settings?: Record<string, unknown>) {
  state.settings = settings;
  return renderToStaticMarkup(<><FashionHeader /><Newsletter /><FashionFooter /></>);
}

afterEach(() => { state.settings = undefined; });

describe("Fashion public shell bundled-theme contract", () => {
  it.each([
    ["configured", { theme: BUNDLED_THEME_KEY }],
    ["missing", {}],
    ["unsupported", { theme: "unreviewed-theme" }],
    ["malformed", { theme: { key: BUNDLED_THEME_KEY } }],
  ])("renders stable bundled theme copy when persisted metadata is %s", (_label, settings) => {
    const html = renderPublicShell(settings);

    expect(html).toContain(fashionTheme.name.toUpperCase());
    expect(html).toContain(fashionTheme.newsletterTitle);
    expect(html).toContain(fashionTheme.navigation[0].label);
  });
});
