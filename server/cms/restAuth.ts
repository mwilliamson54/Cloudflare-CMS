import { TRPCError } from "@trpc/server";
import { getActiveApiToken, getUserById, touchApiToken } from "../db";
import { sha256, verifyApiToken } from "./apiTokens";
import { can, type CmsCapability } from "./permissions";

export async function authenticateRestRequest(authorizationHeader: string | undefined, capability: CmsCapability) {
  const matched = authorizationHeader?.match(/^Bearer\s+(.+)$/i);
  if (!matched) throw new TRPCError({ code: "UNAUTHORIZED", message: "A bearer token is required." });
  const token = matched[1];
  const payload = await verifyApiToken(token, process.env.JWT_SECRET ?? "");
  const [tokenRecord, tokenHash, user] = await Promise.all([
    getActiveApiToken(payload.tokenId),
    sha256(token),
    getUserById(Number(payload.sub)),
  ]);

  if (
    !tokenRecord ||
    tokenRecord.tokenHash !== tokenHash ||
    tokenRecord.userId !== Number(payload.sub) ||
    !user ||
    user.role !== payload.role ||
    (tokenRecord.expiresAt && tokenRecord.expiresAt.getTime() <= Date.now())
  ) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "This API token is invalid or has been revoked." });
  }

  if (!can(user.role, capability)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "This API token does not grant that capability." });
  }

  const requiredScope: Partial<Record<CmsCapability, "content:read" | "content:write" | "media:write" | "taxonomy:write">> = {
    "content:read": "content:read",
    "content:write": "content:write",
    "content:publish": "content:write",
    "media:write": "media:write",
    "taxonomy:write": "taxonomy:write",
  };
  const scope = requiredScope[capability];
  if (scope && !tokenRecord.scopes.includes(scope)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "This API token does not include the required scope." });
  }

  await touchApiToken(payload.tokenId);
  return { user, scopes: tokenRecord.scopes, tokenId: payload.tokenId };
}
