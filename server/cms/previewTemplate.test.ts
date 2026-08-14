import { describe, expect, it } from "vitest";
import { resolvePreviewTemplate } from "../../shared/previewTemplate";

describe("protected preview template resolution", () => {
  it("selects distinct presentation contracts for every supported template", () => {
    expect(resolvePreviewTemplate("landing")).toMatchObject({ template: "landing", eyebrow: "Landing page", heroVariant: "hero" });
    expect(resolvePreviewTemplate("narrative")).toMatchObject({ template: "narrative", eyebrow: "Longform narrative", heroVariant: "cardTwo", contentClass: "max-w-3xl" });
    expect(resolvePreviewTemplate("lookbook")).toMatchObject({ template: "lookbook", eyebrow: "Lookbook", heroVariant: "cardOne", showHero: true });
    expect(resolvePreviewTemplate("minimal")).toMatchObject({ template: "minimal", showHero: false, headlineClass: "max-w-3xl text-5xl md:text-6xl" });
  });

  it("falls back to the default presentation for unknown template keys", () => {
    expect(resolvePreviewTemplate("untrusted-template")).toMatchObject({ template: "default", eyebrow: "Preview", heroVariant: "hero" });
  });
});
