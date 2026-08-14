import { describe, expect, it } from "vitest";
import "../../plugins/registry";
import { listEditorBlocks } from "./blocks";

describe("CMS editor blocks", () => {
  it("exposes core blocks and a plugin-provided block", () => {
    expect(listEditorBlocks().map(block => block.type)).toEqual(expect.arrayContaining(["heading", "quote", "reading-time-note"]));
  });
});
