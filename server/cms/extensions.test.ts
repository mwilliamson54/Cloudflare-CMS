import { describe, expect, it } from "vitest";
import "../../plugins/registry";
import { cmsHooks, registerPlugin, unregisterPlugin } from "./extensions";
import { readingTimePlugin } from "../../plugins/reading-time";
import { listEditorBlocks } from "./blocks";

describe("CMS plugin hooks", () => {
  it("lets the reading-time plugin enrich a post without core changes", async () => {
    const post = await cmsHooks.applyFilters("post.public", { id: 1, title: "An essay", bodyMarkdown: "word ".repeat(440) });
    expect(post.readingTimeMinutes).toBe(2);
  });

  it("removes plugin-owned hooks when a trusted plugin is unregistered", async () => {
    registerPlugin({ key: "temporary-hook", name: "Temporary", version: "1.0.0", register: hooks => hooks.addFilter("post.public", value => ({ ...value, readingTimeMinutes: 99 })) });
    expect((await cmsHooks.applyFilters("post.public", { id: 2, title: "Test", bodyMarkdown: "text" })).readingTimeMinutes).toBe(99);
    unregisterPlugin("temporary-hook");
    expect((await cmsHooks.applyFilters("post.public", { id: 3, title: "Test", bodyMarkdown: "text" })).readingTimeMinutes).not.toBe(99);
  });

  it("can remove and restore the actual reading-time plugin without leaving its hook active", async () => {
    unregisterPlugin(readingTimePlugin.key);
    const removed = await cmsHooks.applyFilters("post.public", { id: 4, title: "Test", bodyMarkdown: "word ".repeat(440) });
    expect(removed.readingTimeMinutes).toBeUndefined();
    expect(listEditorBlocks().some(block => block.type === "reading-time-note")).toBe(false);
    registerPlugin(readingTimePlugin);
    const restored = await cmsHooks.applyFilters("post.public", { id: 5, title: "Test", bodyMarkdown: "word ".repeat(440) });
    expect(restored.readingTimeMinutes).toBe(2);
    expect(listEditorBlocks().some(block => block.type === "reading-time-note")).toBe(true);
  });
});
