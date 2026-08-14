import { TRPCError } from "@trpc/server";
import type { User } from "../../drizzle/schema";

export type CmsRole = User["role"];
export type CmsCapability =
  | "content:read"
  | "content:write"
  | "content:publish"
  | "media:write"
  | "taxonomy:write"
  | "token:manage"
  | "site:manage"
  | "users:manage";

const roleCapabilities: Record<CmsRole, readonly CmsCapability[]> = {
  admin: [
    "content:read",
    "content:write",
    "content:publish",
    "media:write",
    "taxonomy:write",
    "token:manage",
    "site:manage",
    "users:manage",
  ],
  editor: ["content:read", "content:write", "content:publish", "media:write", "taxonomy:write", "token:manage"],
  viewer: ["content:read"],
};

export function can(role: CmsRole, capability: CmsCapability): boolean {
  return roleCapabilities[role].includes(capability);
}

export function requireCapability(user: User, capability: CmsCapability): void {
  if (!can(user.role, capability)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Your role is not permitted to perform this action.",
    });
  }
}
