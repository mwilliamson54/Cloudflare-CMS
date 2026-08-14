# Atelier CMS

Atelier CMS is a lightweight editorial CMS foundation with an elegant fashion-magazine theme. The development adapter in this repository runs as a React, Express, tRPC, MySQL, and S3-compatible application. The production package includes a Cloudflare Pages Functions adapter using D1, R2, KV, and a scheduled Worker, so the core design does not depend on PHP, a local filesystem, or a persistent server process.

## What is included

The project provides persisted content types, posts, pages, flexible custom fields, hierarchical categories, tags, media metadata, API token records, site settings, themes, plugins, and menus. The browser administration area has role-aware content, taxonomy, media, publication-workflow, API-token, and site-identity views. The public `fashion` theme reads published data, with theme defaults only when a fresh install has no editorial content.

| Area | Implementation |
| --- | --- |
| Roles | Exact `admin`, `editor`, and `viewer` values with capability checks on CMS mutations. |
| Statuses | Exact `draft`, `scheduled`, `published`, and `archived` values. |
| Media | Development adapter uses S3-compatible object storage; Cloudflare uses the `CMS_MEDIA` R2 binding. |
| REST API | WordPress-compatible resource paths under `/api/wp/v2/`, with JWT bearer tokens and database-backed revocation. |
| SEO | Per-content canonical and robots fields, dynamic `sitemap.xml`, `robots.txt`, Open Graph and canonical client metadata, plus a Cloudflare sitemap function. |
| Extensions | Hook registry and working Reading Time plugin, documented in `docs/plugins.md`. |

## Local development

Install dependencies with `pnpm install`, then start the workspace with `pnpm dev`. Use `pnpm check` for TypeScript validation and `pnpm test` for the automated CMS tests. The supplied full-stack adapter provides database, storage, and authentication wiring in this environment.

The development environment needs `DATABASE_URL`, `JWT_SECRET`, `CANONICAL_ORIGIN`, and `SITE_NAME`. Never commit their values. In production, provide a cryptographically random JWT secret of at least 32 characters.

## Initial administrator

The project owner is promoted to `admin` during the supplied authentication upsert. For another user, change the `users.role` record to one of `admin`, `editor`, or `viewer` through an administrator-controlled database workflow. Editors can author, schedule, publish, manage media, taxonomies, and their API tokens. Only administrators manage users, global settings, themes, plugins, menus, custom code, and system configuration.

## WordPress-compatible REST API

The exact collection routes are:

| Method | Route | Purpose |
| --- | --- | --- |
| `GET`, `POST` | `/api/wp/v2/posts` | Read published posts or publish programmatically. |
| `GET`, `POST` | `/api/wp/v2/pages` | Read published pages or publish programmatically. |
| `GET`, `POST` | `/api/wp/v2/media` | Read media metadata or upload Base64 media. |
| `GET`, `POST` | `/api/wp/v2/categories` | Read or create categories. |
| `GET`, `POST` | `/api/wp/v2/tags` | Read or create tags. |

Generate a token in **Admin → API tokens**. The raw JWT is visible only once. API callers must send `Authorization: Bearer <token>`. The application verifies the JWT signature, token hash, token record, expiration, revocation state, role, and requested scope on each protected request.

```bash
curl -X POST https://example.com/api/wp/v2/posts \
  -H "Authorization: Bearer $ATELIER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"A new story","slug":"a-new-story","content":{"raw":"# A new story"},"status":"draft"}'
```

## Cloudflare Pages deployment

Create a D1 database, R2 bucket, and optional KV namespace. Update `wrangler.jsonc` and `wrangler.scheduler.jsonc` with their non-secret identifiers. Set `CMS_JWT_SECRET` as a Cloudflare secret rather than a plain variable. Set `CMS_ORIGIN` to the final HTTPS origin.

Run the D1 migration with `pnpm cf:d1:migrate`, build the client using `pnpm build:pages`, then deploy Pages using `pnpm cf:pages:deploy`. Bind `CMS_DB`, `CMS_MEDIA`, and `CMS_CACHE` in the Pages project settings if deploying from the dashboard. Deploy the scheduler Worker separately with `npx wrangler deploy --config wrangler.scheduler.jsonc`; it makes scheduled posts public on a five-minute, idempotent cadence.

> Cloudflare Pages Functions run on the Workers runtime and use bindings for D1, R2, and KV. The separate scheduled Worker uses a UTC five-field Cron Trigger, which avoids server timers and long-running processes. [1] [2]

## Cloudflare configuration and security notes

The included Pages Functions are under `functions/`: the WordPress-compatible REST adapter is `functions/api/wp/v2/[[path]].ts`; `/sitemap.xml` and `/robots.txt` are generated dynamically; media uses the R2-backed `functions/media/[[key]].ts` route. The D1 schema is in `migrations/0001_cms_core.sql`.

The Pages adapter intentionally does not execute arbitrary server-side custom code. Store administrator-controlled head, body, CSS, and JavaScript snippets as reviewed settings and render only where a security review has approved the output. Treat custom code as an administrator-only feature, protect all state-changing requests with authorization and CSRF controls, validate uploads and content server-side, and apply rate limiting with `CMS_CACHE` or Cloudflare WAF rules.

## Themes and plugins

The fashion presentation is confined to `client/src/themes/fashion/`; see `docs/themes.md`. The plugin contract is documented in `docs/plugins.md`. The Reading Time plugin proves the hook architecture by adding a calculated `readingTimeMinutes` field to a public post without changing CMS core modules.

## Free-tier operating model

This project deliberately avoids local persistent files, PHP, Apache/Nginx, native binaries, and in-process background jobs. D1 holds relational data, R2 holds media bytes, KV is optional for caching and throttling, and the scheduled Worker performs due-publication transitions. Use an image delivery service or Cloudflare Images for production image transformations rather than processing large images inside a request.

## References

[1]: https://developers.cloudflare.com/pages/functions/ "Cloudflare Pages Functions"
[2]: https://developers.cloudflare.com/workers/configuration/cron-triggers/ "Cloudflare Workers Cron Triggers"
