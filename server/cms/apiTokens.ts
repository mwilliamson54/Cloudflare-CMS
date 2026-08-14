import { SignJWT, jwtVerify } from "jose";
import type { ApiTokenScope } from "../../drizzle/schema";

const encoder = new TextEncoder();
const algorithm = "HS256";

export type ApiTokenPayload = {
  sub: string;
  role: "admin" | "editor" | "viewer";
  scopes: ApiTokenScope[];
  tokenId: string;
};

function secret(secretValue: string): Uint8Array {
  if (secretValue.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters long.");
  }
  return encoder.encode(secretValue);
}

export async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}

export function createOpaqueSecret(): string {
  const data = new Uint8Array(32);
  crypto.getRandomValues(data);
  return Array.from(data, byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function issueApiToken(
  payload: ApiTokenPayload,
  secretValue: string,
  expiresInSeconds: number,
): Promise<string> {
  return new SignJWT({ role: payload.role, scopes: payload.scopes, tokenId: payload.tokenId })
    .setProtectedHeader({ alg: algorithm, typ: "JWT" })
    .setSubject(payload.sub)
    .setJti(payload.tokenId)
    .setIssuedAt()
    .setExpirationTime(`${expiresInSeconds}s`)
    .sign(secret(secretValue));
}

export async function verifyApiToken(token: string, secretValue: string): Promise<ApiTokenPayload> {
  const result = await jwtVerify(token, secret(secretValue), { algorithms: [algorithm] });
  const scopes = result.payload.scopes;
  const role = result.payload.role;
  const tokenId = result.payload.tokenId;

  if (
    typeof result.payload.sub !== "string" ||
    !["admin", "editor", "viewer"].includes(String(role)) ||
    !Array.isArray(scopes) ||
    !scopes.every(scope => typeof scope === "string") ||
    typeof tokenId !== "string"
  ) {
    throw new Error("Invalid CMS API token claims.");
  }

  return {
    sub: result.payload.sub,
    role: role as ApiTokenPayload["role"],
    scopes: scopes as ApiTokenScope[],
    tokenId,
  };
}
