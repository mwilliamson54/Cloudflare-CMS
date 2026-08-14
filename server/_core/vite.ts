import express, { type Express } from "express";
import fs from "fs";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";
import superjson from "superjson";
import { buildSsrPrefetch } from "./ssrCaller";
import type { HeadMeta } from "../../client/src/ssr/prefetch";

const fallbackHead: HeadMeta = { title: "Atelier Journal", description: "An independent journal of fashion, culture, and considered living." };
const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const compactText = (value: string, max: number) => {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > max ? `${Array.from(text).slice(0, max).join("")}…` : text;
};

function canonicalUrl(value?: string) {
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  const origin = process.env.CANONICAL_ORIGIN?.replace(/\/$/, "");
  return origin ? `${origin}${value.startsWith("/") ? value : `/${value}`}` : undefined;
}

function buildHeadTags(head: HeadMeta) {
  const title = escapeHtml(compactText(head.title || fallbackHead.title, 70));
  const description = escapeHtml(compactText(head.description || fallbackHead.description, 200));
  const canonical = canonicalUrl(head.canonicalPath);
  const image = canonicalUrl(head.ogImage);
  const tags = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<meta property="og:type" content="${head.ogType ?? "website"}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
  ];
  if (canonical) tags.push(`<link rel="canonical" href="${escapeHtml(canonical)}" />`, `<meta property="og:url" content="${escapeHtml(canonical)}" />`);
  if (image) tags.push(`<meta property="og:image" content="${escapeHtml(image)}" />`, `<meta name="twitter:image" content="${escapeHtml(image)}" />`);
  if (head.ogType === "article" && head.publishedTime) tags.push(`<meta property="article:published_time" content="${escapeHtml(head.publishedTime)}" />`);
  if (head.ogType === "article" && head.modifiedTime) tags.push(`<meta property="article:modified_time" content="${escapeHtml(head.modifiedTime)}" />`);
  if (head.noindex || head.notFound) tags.push(`<meta name="robots" content="noindex, follow" />`);
  return tags.join("\n");
}

function composeHtml(template: string, html: string, head: HeadMeta, state: unknown) {
  const serialized = JSON.stringify(superjson.serialize(state)).replace(/</g, "\\u003c");
  return template
    .replace("</body>", () => `<script>window.__RQ_STATE__ = ${serialized}</script></body>`)
    .replace("<!--app-head-->", () => buildHeadTags(head))
    .replace("<!--app-html-->", () => html);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(`src="/src/entry-client.tsx"`, `src="/src/entry-client.tsx?v=${nanoid()}"`);
      template = await vite.transformIndexHtml(url, template);
      template = template.replace("</head>", `<link rel="stylesheet" href="/src/index.css?direct" data-ssr-dev-css></head>`);
      const { render } = await vite.ssrLoadModule("/src/entry-server.tsx");
      const prefetch = await buildSsrPrefetch(req, res);
      const page = await render(url, prefetch);
      res.status(page.head.notFound ? 404 : 200).set({ "Content-Type": "text/html", "Cache-Control": "no-cache" }).end(composeHtml(template, page.html, page.head, page.dehydratedState));
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath =
    process.env.NODE_ENV === "development"
      ? path.resolve(import.meta.dirname, "../..", "dist", "public")
      : path.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }

  app.use((req, res, next) => {
    if (req.path === "/index.html") return res.redirect(301, "/");
    if (req.path !== "/" && /\/+$/.test(req.path)) return res.redirect(301, (req.path.replace(/\/+$/, "") || "/") + req.originalUrl.slice(req.path.length));
    next();
  });
  app.use(express.static(distPath, { index: false, redirect: false }));
  app.use("*", async (req, res) => {
    const templatePath = path.resolve(distPath, "index.html");
    try {
      const template = await fs.promises.readFile(templatePath, "utf-8");
      const entryPath = process.env.NODE_ENV === "development"
        ? path.resolve(import.meta.dirname, "../..", "dist", "server-ssr", "entry-server.js")
        : path.resolve(import.meta.dirname, "server-ssr", "entry-server.js");
      const { render } = await import(entryPath);
      const prefetch = await buildSsrPrefetch(req, res);
      const page = await render(req.originalUrl, prefetch);
      res.status(page.head.notFound ? 404 : 200).set({ "Content-Type": "text/html", "Cache-Control": "no-cache" }).end(composeHtml(template, page.html, page.head, page.dehydratedState));
    } catch (error) {
      console.error("[SSR] render failed, serving client shell:", error);
      const template = await fs.promises.readFile(templatePath, "utf-8");
      res.status(200).set({ "Content-Type": "text/html", "Cache-Control": "no-cache" }).end(composeHtml(template, "", fallbackHead, {}));
    }
  });
}
