import { describe, expect, it } from "vitest";
import { createOpaqueSecret, issueApiToken, sha256, verifyApiToken } from "./apiTokens";

const secret = "cms-test-secret-that-is-longer-than-thirty-two-characters";

describe("CMS API tokens", () => {
  it("issues and verifies a JWT containing the caller role and scopes", async () => {
    const token = await issueApiToken(
      {
        sub: "42",
        role: "editor",
        scopes: ["content:read", "content:write"],
        tokenId: "token-42",
      },
      secret,
      3600,
    );

    await expect(verifyApiToken(token, secret)).resolves.toMatchObject({
      sub: "42",
      role: "editor",
      scopes: ["content:read", "content:write"],
      tokenId: "token-42",
    });
  });

  it("hashes opaque secrets and does not produce repeatable secrets", async () => {
    const first = createOpaqueSecret();
    const second = createOpaqueSecret();
    expect(first).not.toEqual(second);
    await expect(sha256(first)).resolves.toMatch(/^[a-f0-9]{64}$/);
  });
});
