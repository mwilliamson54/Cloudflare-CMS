import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sdkMock = vi.hoisted(() => ({ authenticateRequest: vi.fn() }));
vi.mock("./sdk", () => ({ sdk: sdkMock }));

import { createContext } from "./context";

const originalEnvironment = { nodeEnv: process.env.NODE_ENV, e2e: process.env.CMS_E2E_TEST_AUTH };

function options(headerValue?: string) {
  return { req: { header: vi.fn(() => headerValue) }, res: {} } as any;
}

describe("development-only editor browser test session", () => {
  beforeEach(() => { vi.clearAllMocks(); process.env.NODE_ENV = "development"; delete process.env.CMS_E2E_TEST_AUTH; });
  afterEach(() => {
    process.env.NODE_ENV = originalEnvironment.nodeEnv;
    if (originalEnvironment.e2e === undefined) delete process.env.CMS_E2E_TEST_AUTH;
    else process.env.CMS_E2E_TEST_AUTH = originalEnvironment.e2e;
  });

  it("requires the explicit development environment switch and request marker", async () => {
    sdkMock.authenticateRequest.mockResolvedValue(null);
    await expect(createContext(options("enabled"))).resolves.toMatchObject({ user: null });

    process.env.CMS_E2E_TEST_AUTH = "1";
    await expect(createContext(options("disabled"))).resolves.toMatchObject({ user: null });
    await expect(createContext(options("enabled"))).resolves.toMatchObject({ user: { id: 990_001, role: "admin", openId: "cms-e2e-editor" } });
  });

  it("never enables the fixture outside development", async () => {
    process.env.CMS_E2E_TEST_AUTH = "1";
    process.env.NODE_ENV = "production";
    sdkMock.authenticateRequest.mockResolvedValue(null);

    await expect(createContext(options("enabled"))).resolves.toMatchObject({ user: null });
    expect(sdkMock.authenticateRequest).toHaveBeenCalledTimes(1);
  });
});
