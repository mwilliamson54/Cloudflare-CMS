import { describe, expect, it } from "vitest";
import { authenticateRestRequest } from "./restAuth";

describe("REST API authentication", () => {
  it("rejects requests that omit the JWT bearer token", async () => {
    await expect(authenticateRestRequest(undefined, "content:write")).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
