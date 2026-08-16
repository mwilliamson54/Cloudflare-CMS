import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo, useState } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

type CloudflareUser = {
  id: number;
  email: string | null;
  name: string | null;
  role: string;
};

const isCloudflareAuth = () => import.meta.env.VITE_CMS_AUTH_MODE === "cloudflare";
const csrfCookie = () => document.cookie.split(";").map(value => value.trim()).find(value => value.startsWith("cms_csrf_token="))?.slice("cms_csrf_token=".length) ?? "";

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const cloudflareMode = isCloudflareAuth();
  const utils = trpc.useUtils();
  const [cloudflareUser, setCloudflareUser] = useState<CloudflareUser | null>(null);
  const [cloudflareLoading, setCloudflareLoading] = useState(cloudflareMode);
  const [cloudflareError, setCloudflareError] = useState<Error | null>(null);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: !cloudflareMode,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => utils.auth.me.setData(undefined, null),
  });

  const refreshCloudflare = useCallback(async () => {
    if (!cloudflareMode) return;
    setCloudflareLoading(true);
    try {
      const response = await fetch("/api/auth/me", { credentials: "include" });
      if (!response.ok) {
        setCloudflareUser(null);
        if (response.status !== 401) throw new Error(`Authentication request failed (${response.status}).`);
        return;
      }
      const data = await response.json() as { user?: CloudflareUser | null };
      setCloudflareUser(data.user ?? null);
      setCloudflareError(null);
    } catch (error) {
      setCloudflareError(error instanceof Error ? error : new Error("Authentication request failed."));
      setCloudflareUser(null);
    } finally {
      setCloudflareLoading(false);
    }
  }, [cloudflareMode]);

  useEffect(() => { void refreshCloudflare(); }, [refreshCloudflare]);

  const logout = useCallback(async () => {
    if (cloudflareMode) {
      const response = await fetch("/api/auth/logout", { method: "POST", credentials: "include", headers: { "content-type": "application/json", "x-csrf-token": decodeURIComponent(csrfCookie()) }, body: "{}" });
      if (!response.ok && response.status !== 401) throw new Error(`Logout failed (${response.status}).`);
      setCloudflareUser(null);
      return;
    }
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (error instanceof TRPCClientError && error.data?.code === "UNAUTHORIZED") return;
      throw error;
    } finally {
      try { sessionStorage.removeItem("manus-cookie"); } catch {}
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [cloudflareMode, logoutMutation, utils]);

  const user = cloudflareMode ? cloudflareUser : meQuery.data ?? null;
  const loading = cloudflareMode ? cloudflareLoading : meQuery.isLoading || logoutMutation.isPending;
  const error = cloudflareMode ? cloudflareError : meQuery.error ?? logoutMutation.error ?? null;

  const state = useMemo(() => {
    try { localStorage.setItem("manus-runtime-user-info", JSON.stringify(user)); } catch {}
    return { user, loading, error, isAuthenticated: Boolean(user) };
  }, [error, loading, user]);

  useEffect(() => {
    if (!redirectOnUnauthenticated || loading || state.user || typeof window === "undefined") return;
    if (redirectPath && window.location.pathname === redirectPath) return;
    if (redirectPath) window.location.href = redirectPath;
    else if (cloudflareMode) window.location.href = "/login";
    else startLogin();
  }, [cloudflareMode, loading, redirectOnUnauthenticated, redirectPath, state.user]);

  return { ...state, refresh: cloudflareMode ? refreshCloudflare : () => meQuery.refetch(), logout };
}
