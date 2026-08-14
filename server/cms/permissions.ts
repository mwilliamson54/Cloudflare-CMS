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

/**
 * WordPress-style capability matrix. `admin` remains the administrator role
 * for compatibility with existing users, while `viewer` remains a read-only
 * compatibility role alongside the WordPress-style `subscriber` level.
 */
const roleCapabilities: Record<CmsRole, readonly CmsCapability[]> = {
  admin: ["content:read", "content:write", "content:publish", "media:write", "taxonomy:write", "token:manage", "site:manage", "users:manage"],
  editor: ["content:read", "content:write", "content:publish", "media:write", "taxonomy:write", "token:manage"],
  author: ["content:read", "content:write", "content:publish", "media:write", "token:manage"],
  contributor: ["content:read", "content:write", "media:write"],
  subscriber: ["content:read"],
  viewer: ["content:read"],
};

export function can(role: CmsRole, capability: CmsCapability): boolean {
  return roleCapabilities[role].includes(capability);
}

export function requireCapability(user: User, capability: CmsCapability): void {
  if (!can(user.role, capability)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Your role is not permitted to perform this action." });
  }
}

/** Authors and contributors may only alter entries that they own. */
export function requireEntryOwnership(user: User, entry: { authorId: number }): void {
  if ((user.role === "author" || user.role === "contributor") && entry.authorId !== user.id) {
    throw new TRPCError({ code: "FORBIDDEN", message: "You may only manage content you authored." });
  }
}

/** Authors and contributors may only alter media records they uploaded. */
export function requireMediaOwnership(user: User, record: { uploadedById: number }): void {
  if ((user.role === "author" || user.role === "contributor") && record.uploadedById !== user.id) {
    throw new TRPCError({ code: "FORBIDDEN", message: "You may only manage media you uploaded." });
  }
}

/** Prevent any account from accidentally removing its own last administrator access. */
export function requireRoleChangeAllowed(actor: User, target: Pick<User, "id" | "role">, nextRole: CmsRole): void {
  requireCapability(actor, "users:manage");
  if (actor.id === target.id && nextRole !== "admin") {
    throw new TRPCError({ code: "BAD_REQUEST", message: "You cannot remove your own administrator access." });
  }
}
