import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

const e2eEditorUser: User = {
  id: 990_001,
  openId: "cms-e2e-editor",
  name: "CMS E2E Editor",
  email: "cms-e2e-editor@localhost",
  loginMethod: "e2e",
  role: "admin",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  const e2eMode = process.env.NODE_ENV === "development" && process.env.CMS_E2E_TEST_AUTH === "1";
  if (e2eMode && opts.req.header("x-cms-e2e-test-auth") === "enabled") {
    user = e2eEditorUser;
  } else {
    try {
      user = await sdk.authenticateRequest(opts.req);
    } catch (error) {
      // Authentication is optional for public procedures.
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
