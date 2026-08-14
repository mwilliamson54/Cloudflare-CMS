import { HydrationBoundary, QueryClient, QueryClientProvider, type DehydratedState } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot, hydrateRoot } from "react-dom/client";
import superjson from "superjson";
import { trpc } from "@/lib/trpc";
import { COOKIE_NAME, CSRF_COOKIE_NAME, CSRF_HEADER_NAME, UNAUTHED_ERR_MSG } from "@shared/const";
import App from "./App";
import { startLogin } from "./const";
import "./index.css";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });

function redirectToLoginIfUnauthorized(error: unknown) {
  if (!(error instanceof TRPCClientError) || error.message !== UNAUTHED_ERR_MSG) return;
  startLogin();
}

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") redirectToLoginIfUnauthorized(event.query.state.error);
});
queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") redirectToLoginIfUnauthorized(event.mutation.state.error);
});

const trpcClient = trpc.createClient({
  links: [httpBatchLink({
    url: "/api/trpc",
    transformer: superjson,
    headers() {
      const csrfToken = document.cookie.split(";").map(part => part.trim()).find(part => part.startsWith(`${CSRF_COOKIE_NAME}=`))?.slice(`${CSRF_COOKIE_NAME}=`.length);
      const headers: Record<string, string> = csrfToken ? { [CSRF_HEADER_NAME]: csrfToken } : {};
      try {
        const raw = sessionStorage.getItem("manus-cookie");
        const token = raw?.split(";").find(part => part.trim().startsWith(`${COOKIE_NAME}=`))?.trim().slice(`${COOKIE_NAME}=`.length);
        if (token) return { ...headers, Authorization: `Bearer ${token}` };
      } catch { /* Storage is unavailable in some embedded browsers. */ }
      return headers;
    },
    fetch(input, init) { return globalThis.fetch(input, { ...(init ?? {}), credentials: "include" }); },
  })],
});

const rawState = (window as Window & { __RQ_STATE__?: unknown }).__RQ_STATE__;
const dehydratedState = rawState ? superjson.deserialize(rawState as Parameters<typeof superjson.deserialize>[0]) as DehydratedState : undefined;
const tree = <trpc.Provider client={trpcClient} queryClient={queryClient}><QueryClientProvider client={queryClient}><HydrationBoundary state={dehydratedState}><App /></HydrationBoundary></QueryClientProvider></trpc.Provider>;
const root = document.getElementById("root");
if (!root) throw new Error("Missing application root.");
if (root.hasChildNodes()) hydrateRoot(root, tree); else createRoot(root).render(tree);
