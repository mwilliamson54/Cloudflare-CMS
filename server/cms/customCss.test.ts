import { describe, expect, it } from "vitest";
import { CUSTOM_CSS_MAX_LENGTH, getCustomCssValidationError } from "./customCss";

describe("controlled custom CSS validation", () => {
  it("accepts local presentational CSS", () => {
    expect(getCustomCssValidationError(".site-accent { color: #a77150; }\n@media (min-width: 768px) { .site-accent { letter-spacing: .1em; } }")).toBeNull();
  });

  it.each([
    ["remote imports", '@import url("https://example.test/theme.css");'],
    ["remote URLs", ".hero { background: url(https://example.test/image.jpg); }"],
    ["legacy executable expressions", ".legacy { width: expression(alert(1)); }"],
    ["script URLs", ".legacy { behavior: url(javascript:alert(1)); }"],
    ["markup", "</style><script>alert(1)</script>"],
  ])("rejects %s", (_label, css) => {
    expect(getCustomCssValidationError(css)).toMatch(/cannot contain/i);
  });

  it("bounds the persisted CSS payload", () => {
    expect(getCustomCssValidationError("a".repeat(CUSTOM_CSS_MAX_LENGTH + 1))).toMatch(/at most/i);
  });
});
