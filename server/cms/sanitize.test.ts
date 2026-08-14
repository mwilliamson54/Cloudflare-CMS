import { describe, expect, it } from "vitest";
import { sanitizeRichHtml } from "./sanitize";

describe("source-mode HTML sanitizer", () => {
  it("removes scripts, event handlers, unsafe URLs, and unknown tags", () => {
    const clean = sanitizeRichHtml('<p onclick="alert(1)">Text<script>alert(1)</script><a href="javascript:alert(1)">link</a><video src="x"></video></p>');
    expect(clean).toBe('<p>Text<a>link</a></p>');
  });

  it("retains safe editorial markup and strengthens external links", () => {
    const clean = sanitizeRichHtml('<h2>Title</h2><a href="https://example.com" target="_blank">Read</a>');
    expect(clean).toContain('<h2>Title</h2>');
    expect(clean).toContain('rel="noopener noreferrer"');
  });
});
