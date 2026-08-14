import { describe, expect, it } from "vitest";
import "../../plugins/registry";
import { cmsHooks } from "./extensions";

describe("CMS plugin hooks", () => {
  it("lets the reading-time plugin enrich a post without core changes", async () => {
    const post = await cmsHooks.applyFilters("post.public", { id: 1, title: "An essay", bodyMarkdown: "word ".repeat(440) });
    expect(post.readingTimeMinutes).toBe(2);
  });
});
