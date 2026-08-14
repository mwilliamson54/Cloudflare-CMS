# Atelier CMS Architecture

Atelier CMS is a **portable CMS core** with two execution adapters. The development adapter uses the supplied React, Express, tRPC, MySQL, and S3-compatible template so the application can be exercised in this workspace. The production adapter is designed for Cloudflare Pages Functions, D1, R2, KV, and an optional scheduled Worker, with no dependency on a persistent Node.js process or local filesystem.

| Concern | Portable CMS layer | Cloudflare production adapter | Development adapter |
| --- | --- | --- | --- |
| Content and permissions | `cms-core` domain models, validation, workflow, repositories | D1 prepared statements behind repository implementations | Drizzle/MySQL repository implementations |
| Public and administrative HTTP | REST DTOs and route handlers | Pages Functions under `functions/` | Express routes and tRPC admin procedures |
| Authentication | JWT signing/verification, token registry, role policies | Web Crypto with D1-backed revocation and KV throttling | Manus session for the dashboard plus the same API-token policy |
| Media | `MediaStorage` interface | R2 binding or configured S3-compatible origin | Supplied S3-compatible storage helper |
| Caching | cache-key and invalidation interface | Cache API and optional KV bindings | Cache-control headers and in-memory no-op adapter |
| Scheduled publication | idempotent due-content processor | Dedicated Worker `scheduled()` handler against D1 | Manual admin action; production scheduler remains the source of truth |

## Boundary rules

The CMS core does not know about fashion categories, hero layouts, or a specific database. It defines content, taxonomies, settings, users, media, SEO, menus, hooks, and repository contracts. The fashion magazine is a theme that consumes these contracts. The `reading-time` extension is a separately registered plugin that observes post events and contributes a presentation field without editing CMS business logic.

All data-changing operations are validated on the server. Admin browser operations require an authenticated session and role check. Programmatic publishing uses a short-lived HS256 JWT containing a `jti`; its registry record is checked on every request so a token can be revoked immediately. No raw API token is persisted. Custom code is restricted to administrators and treated as explicitly dangerous configuration; the Cloudflare adapter does not execute arbitrary server-side code.

## Cloudflare runtime topology

The intended Cloudflare deployment is a Pages project with a compiled client bundle and Pages Functions. `CMS_DB` is a D1 binding, `CMS_MEDIA` is an R2 binding, and `CMS_CACHE` is an optional KV binding. Public pages may be served from Pages; authenticated and dynamic routes execute in Functions. A separate scheduled Worker, configured with a five-field UTC cron, marks due content as published through D1. This avoids timers and keeps scheduled publishing idempotent.

> Pages Functions run on the Workers runtime and can use D1, R2, and KV bindings. Scheduled work is placed in a Worker `scheduled()` handler rather than a long-running process. [1] [2] [3]

## API contract

The WordPress-compatible resource routes are fixed at `/api/wp/v2/posts`, `/api/wp/v2/pages`, `/api/wp/v2/media`, `/api/wp/v2/categories`, and `/api/wp/v2/tags`. Collection `GET` calls expose published content unless a valid token with the required role is presented. Content mutation requires `Authorization: Bearer <JWT>`. Authentication and API-token lifecycle routes live under `/api/auth` and `/api/admin/api-tokens`; their paths are intentionally separate from the WordPress-compatible resource namespace.

## Role policy

| Capability | Admin | Editor | Viewer |
| --- | --- | --- | --- |
| Read CMS data | Yes | Yes | Yes |
| Create or edit posts, pages, taxonomies, and media | Yes | Yes | No |
| Publish or schedule content | Yes | Yes | No |
| Generate or revoke own API tokens | Yes | Yes | No |
| Manage users, settings, themes, plugins, menus, custom code, and global SEO | Yes | No | No |

## Deployment limits and alternatives

The architecture deliberately excludes PHP, server daemons, native modules, persistent local files, in-process jobs, and direct execution of administrator-entered server code. Image transformations should use Cloudflare Images or preprocessed variants in a future integration; the initial media library stores original objects and responsive metadata only. Cache invalidation uses revisioned cache keys rather than attempting to purge arbitrary edge state from an untrusted browser request.

## References

[1]: https://developers.cloudflare.com/pages/functions/ "Cloudflare Pages Functions"
[2]: https://developers.cloudflare.com/pages/functions/bindings/ "Cloudflare Pages Function bindings"
[3]: https://developers.cloudflare.com/workers/configuration/cron-triggers/ "Cloudflare Workers Cron Triggers"
