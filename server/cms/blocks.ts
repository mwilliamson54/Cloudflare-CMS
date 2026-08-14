export type EditorBlock = {
  type: string;
  label: string;
  markdown: string;
};

type RegisteredEditorBlock = EditorBlock & { pluginKey?: string };

const blocks = new Map<string, RegisteredEditorBlock>([
  ["heading", { type: "heading", label: "Heading", markdown: "## New heading\n\n" }],
  ["paragraph", { type: "paragraph", label: "Paragraph", markdown: "Write a considered paragraph here.\n\n" }],
  ["quote", { type: "quote", label: "Pull quote", markdown: "> A detail worth holding onto.\n\n" }],
  ["image", { type: "image", label: "Image", markdown: "![Describe the image](https://)\n\n" }],
  ["divider", { type: "divider", label: "Divider", markdown: "---\n\n" }],
]);

export function registerEditorBlock(block: EditorBlock, pluginKey?: string) {
  if (blocks.has(block.type)) throw new Error(`An editor block named ${block.type} is already registered.`);
  blocks.set(block.type, { ...block, pluginKey });
}

export function unregisterEditorBlock(type: string) {
  // Core blocks are immutable platform features; plugin blocks use distinct keys.
  if (["heading", "paragraph", "quote", "image", "divider"].includes(type)) return false;
  return blocks.delete(type);
}

export function listEditorBlocks(enabledPluginKeys?: readonly string[]) {
  return Array.from(blocks.values())
    .filter(block => !block.pluginKey || !enabledPluginKeys || enabledPluginKeys.includes(block.pluginKey))
    .map(({ pluginKey: _pluginKey, ...block }) => block);
}
