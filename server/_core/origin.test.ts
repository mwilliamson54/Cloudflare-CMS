import { describe, expect, it } from "vitest";
import { hasValidCsrfToken, isSameOriginRequest } from "./origin";

describe("CMS request origin guard", () => {
  it("permits same-origin and non-browser requests", () => {
    expect(isSameOriginRequest("https://atelier.example", "atelier.example")).toBe(true);
    expect(isSameOriginRequest(undefined, "atelier.example")).toBe(true);
  });

  it("rejects malformed and cross-origin browser requests", () => {
    expect(isSameOriginRequest("https://attacker.example", "atelier.example")).toBe(false);
    expect(isSameOriginRequest("not a url", "atelier.example")).toBe(false);
  });

  it("requires an exact double-submit CSRF token match for cookie sessions", () => {
    expect(hasValidCsrfToken("issued-token", "issued-token")).toBe(true);
    expect(hasValidCsrfToken("issued-token", "wrong-token")).toBe(false);
    expect(hasValidCsrfToken("issued-token", undefined)).toBe(false);
  });
});
