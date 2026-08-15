import { describe, expect, it } from "vitest";
import { blocksToHtml, blocksToMarkdown, isTrustedEmbedUrl, type GraphicalBlock } from "./GraphicalBlockEditor";

describe("graphical editor serialization", () => {
  const blocks: GraphicalBlock[] = [
    { id: "heading", type: "heading", level: 3, text: "A considered heading" },
    { id: "list", type: "list", ordered: false, items: ["First", "Second"] },
    { id: "table", type: "table", headers: ["Season", "Mood"], rows: [["Autumn", "Quiet"]] },
    { id: "image", type: "image", mediaId: 9, src: "/media/uploads/2026/08/u7/look.webp", alt: "A tailored yellow set", caption: "Lookbook study" },
    { id: "embed", type: "embed", url: "https://www.youtube-nocookie.com/embed/abc", title: "Studio film" },
    { id: "widget", type: "widget", widget: "callout", title: "Editor note", body: "A trusted structured widget." },
  ];

  it("serializes every graphical block type into portable Markdown and safe editorial HTML", () => {
    const markdown = blocksToMarkdown(blocks);
    const html = blocksToHtml(blocks);
    expect(markdown).toContain("<!-- atelier-graphical:");
    expect(markdown).toContain("### A considered heading");
    expect(html).toContain("<h3>A considered heading</h3>");
    expect(html).toContain("<table>");
    expect(html).toContain('src="/media/uploads/2026/08/u7/look.webp"');
    expect(html).toContain('sandbox="allow-scripts allow-same-origin allow-presentation"');
    expect(html).toContain("cms-widget-callout");
  });

  it("limits embeds to the declared HTTPS provider allowlist", () => {
    expect(isTrustedEmbedUrl("https://player.vimeo.com/video/123")).toBe(true);
    expect(isTrustedEmbedUrl("http://www.youtube.com/embed/abc")).toBe(false);
    expect(isTrustedEmbedUrl("https://evil.example/embed/abc")).toBe(false);
    expect(blocksToHtml([{ id: "blocked", type: "embed", url: "https://evil.example/embed/abc", title: "Blocked" }])).toBe("");
  });
});
