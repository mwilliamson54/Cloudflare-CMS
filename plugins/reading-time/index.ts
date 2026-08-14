import { registerPlugin, type CmsPlugin } from "../../server/cms/extensions";
import { registerEditorBlock, unregisterEditorBlock } from "../../server/cms/blocks";

export const readingTimePlugin: CmsPlugin = {
  key: "reading-time",
  name: "Reading Time",
  version: "1.0.0",
  register(hooks) {
    registerEditorBlock({ type: "reading-time-note", label: "Reading-time note", markdown: "<aside data-reading-time>Estimated reading time appears here.</aside>\n\n" });
    hooks.addFilter("post.public", post => ({
      ...post,
      readingTimeMinutes: Math.max(1, Math.ceil((post.bodyMarkdown || "").trim().split(/\s+/).filter(Boolean).length / 220)),
    }));
  },
  unregister() {
    unregisterEditorBlock("reading-time-note");
  },
};

registerPlugin(readingTimePlugin);
