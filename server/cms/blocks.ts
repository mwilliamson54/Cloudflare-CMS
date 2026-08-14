export type EditorBlock = {
  type: string;
  label: string;
  markdown: string;
};

const blocks = new Map<string, EditorBlock>([
  ["heading", { type: "heading", label: "Heading", markdown: "## New heading\n\n" }],
  ["paragraph", { type: "paragraph", label: "Paragraph", markdown: "Write a considered paragraph here.\n\n" }],
  ["quote", { type: "quote", label: "Pull quote", markdown: "> A detail worth holding onto.\n\n" }],
  ["image", { type: "image", label: "Image", markdown: "![Describe the image](https://)\n\n" }],
  ["divider", { type: "divider", label: "Divider", markdown: "---\n\n" }],
]);

export function registerEditorBlock(block: EditorBlock) {
  if (blocks.has(block.type)) throw new Error(`An editor block named ${block.type} is already registered.`);
  blocks.set(block.type, block);
}

export function listEditorBlocks() { return Array.from(blocks.values()); }
