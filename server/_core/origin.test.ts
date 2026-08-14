import { describe, expect, it } from "vitest";
import { isSameOriginRequest } from "./origin";

describe("CMS request origin guard", () => {
  it("permits same-origin and non-browser requests", () => {
    expect(isSameOriginRequest("https://atelier.example", "atelier.example")).toBe(true);
    expect(isSameOriginRequest(undefined, "atelier.example")).toBe(true);
  });

  it("rejects malformed and cross-origin browser requests", () => {
    expect(isSameOriginRequest("https://attacker.example", "atelier.example")).toBe(false);
    expect(isSameOriginRequest("not a url", "atelier.example")).toBe(false);
  });
});
