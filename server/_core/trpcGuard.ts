import { parse as parseCookieHeader } from "cookie";
import type { NextFunction, Request, Response } from "express";
import { COOKIE_NAME, CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "@shared/const";
import { hasValidCsrfToken, isSameOriginRequest } from "./origin";

/** Guards the cookie-authenticated tRPC surface; REST bearer tokens are mounted separately. */
export function trpcRequestGuard(req: Request, res: Response, next: NextFunction) {
  if (!isSameOriginRequest(req.get("origin"), req.get("host"))) {
    res.status(403).json({ error: "Cross-origin CMS requests are not allowed." });
    return;
  }
  const cookies = parseCookieHeader(req.headers.cookie ?? "");
  const isStateChangingRequest = !["GET", "HEAD", "OPTIONS"].includes(req.method);
  if (isStateChangingRequest && cookies[COOKIE_NAME] && !hasValidCsrfToken(cookies[CSRF_COOKIE_NAME], req.get(CSRF_HEADER_NAME))) {
    res.status(403).json({ error: "Missing or invalid CSRF token." });
    return;
  }
  next();
}
