# Atelier CMS Production Resource Plan

This plan is intentionally non-destructive. It records the exact resources and binding contract required by the current source without creating, replacing, or mutating Cloudflare resources.

## Current account state

The verified account inventory for account `a2ae0c48e84a82b2f81082e677483e3f` contains no D1 databases, no KV namespaces, and no Pages projects. The R2 inventory call is blocked with Cloudflare error 10042 because R2 must first be enabled in the Cloudflare Dashboard. Consequently, stable resource identifiers are not yet available and the resource-creation steps must remain manual/approved.

## Required resources and stable bindings

| Resource | Intended name | Binding | Identifier required in deployment |
| --- | --- | --- | --- |
| D1 database | `atelier-cms` | `CMS_DB` | `database_id` inserted into `wrangler.jsonc` and `wrangler.scheduler.jsonc` |
| R2 bucket | `atelier-cms-media` | `CMS_MEDIA` | bucket name in Pages Functions binding; R2 must be enabled first |
| KV namespace | `atelier-cms-cache` | `CMS_CACHE` | namespace ID inserted into `wrangler.jsonc`; optional for the current safe public path |
| Pages project | `atelier-cms` | Pages Functions | GitHub `main` branch, build output `client/dist`, Functions under `functions/` |

## Migration order

Apply `migrations/0001_cms_core.sql` through `migrations/0006_menus.sql` exactly once to the newly created D1 database using the Cloudflare D1 migration workflow. Verify table presence and row counts after each migration batch. Do not recreate the database or apply destructive reset commands during a Pages deployment. The scheduler Worker must reference the same D1 `database_id` and must never create a second database.

## Wrangler contract

`wrangler.jsonc` is the source-of-truth contract for Pages-compatible bindings. Replace only the explicit placeholders `REPLACE_WITH_D1_DATABASE_ID` and `REPLACE_WITH_KV_NAMESPACE_ID` after resources are created and recorded. Set `CMS_ORIGIN` to the final production origin and retain the token TTL unless an approved security decision changes it. Configure the same `CMS_DB` ID in `wrangler.scheduler.jsonc`; do not use a separate database for the scheduled publisher.

## Secrets

Set `CMS_AUTH_BOOTSTRAP_SECRET` as a Pages secret before first bootstrap. Set `CMS_JWT_SECRET` or the project’s documented JWT secret variable as required by the Pages auth/token implementation. Never commit these values, D1 exports, R2 credentials, or `.env` files. Perform bootstrap once, immediately rotate or remove the bootstrap secret, and verify that a second bootstrap returns conflict.

## Pages dashboard settings

Connect the repository only after the GitHub credential is repaired and the intended `main` branch is verified. Use the repository’s documented build command and output directory, confirm Functions detection, configure `CMS_DB` and `CMS_MEDIA` bindings against the stable resources, and add `CMS_CACHE` only when the namespace exists. Enable production deployment only after a migration smoke test and a persistence test across two revisions.

## Scheduler

The optional scheduler Worker uses `*/5 * * * *` and the same D1 database. Deploy it only after D1 migration verification. Its idempotent processing must be tested against scheduled content and must not be used as a substitute for stable data bindings.

## Explicit safeguards

No resource was created or mutated while this plan was prepared. The plan cannot be completed with live identifiers until R2 is enabled, resources are created with user approval, GitHub access is restored, and the intended Pages project is confirmed. A second deployment must prove that content, sessions, media metadata, and menus survive without recreating or replacing D1/R2 resources.
