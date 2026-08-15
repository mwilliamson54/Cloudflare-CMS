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

  it("retains tables and normalizes trusted embeds while rejecting untrusted frame sources", () => {
    const trusted = sanitizeRichHtml('<table><tr><th>Column</th></tr><tr><td>Value</td></tr></table><iframe src="https://www.youtube-nocookie.com/embed/abc" title="Film" onload="alert(1)"></iframe>');
    expect(trusted).toContain("<table><tr><th>Column</th></tr><tr><td>Value</td></tr></table>");
    expect(trusted).toContain('src="https://www.youtube-nocookie.com/embed/abc"');
    expect(trusted).toContain('sandbox="allow-scripts allow-same-origin allow-presentation"');
    expect(sanitizeRichHtml('<iframe src="https://evil.example/embed"></iframe>')).toBeNull();
  });
});
