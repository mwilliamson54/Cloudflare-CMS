import { describe, expect, it } from "vitest";
import { parseCustomFields } from "./customFields";

describe("custom content field specifications", () => {
  it("parses typed fields and select values into editor-ready definitions", () => {
    expect(parseCustomFields("season:select:Spring|High Summer|Autumn\nhero_image:media\nrelease_date:date")).toEqual([
      { key: "season", label: "season", type: "select", options: [{ value: "spring", label: "Spring" }, { value: "high-summer", label: "High Summer" }, { value: "autumn", label: "Autumn" }] },
      { key: "hero-image", label: "hero image", type: "media", options: undefined },
      { key: "release-date", label: "release date", type: "date", options: undefined },
    ]);
  });

  it("falls back safely for unsupported type declarations", () => {
    expect(parseCustomFields("mood:unknown")).toEqual([{ key: "mood", label: "mood", type: "text", options: undefined }]);
  });
});
