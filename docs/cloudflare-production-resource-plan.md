# Atelier CMS Production Resource Plan

This plan is intentionally non-destructive. It records the exact resources and binding contract required by the current source without creating, replacing, or mutating Cloudflare resources.

## Current account state

The refreshed verified account is `d20c68056ef972d805bd177e2a0ab145`. It now contains the provisioned Atelier resources listed below. The account also contains an unrelated Pages project, `mrx-app-builder`; it is not reused or modified.

## Required resources and stable bindings

| Resource | Intended name | Binding | Identifier required in deployment |
| --- | --- | --- | --- |
| D1 database | `atelier-cms` | `CMS_DB` | `d79481e3-a539-4c79-9cdb-3b8f4ae3cb65` |
| R2 bucket | `atelier-cms-media` | `CMS_MEDIA` | `atelier-cms-media` in Pages Functions binding; provisioned in WEUR |
| KV namespace | `atelier-cms-cache` | `CMS_CACHE` | `0ba1110d7669485ea698bb60dc538be8` |
| Pages project | `atelier-cms` | Pages Functions | Project ID `b47fe04b-f35b-4db6-8055-b0ceba561753`; `https://atelier-cms.pages.dev`; GitHub `mwilliamson54/Cloudflare-CMS`, branch `main`, build output `client/dist`, Functions under `functions/` |

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

D1, R2, and KV were provisioned in the refreshed account after the user’s deployment request and are recorded above. The unrelated existing Pages project was not modified. The Atelier Pages project is created and bound to the stable resources; its first GitHub deployment is now pending/needs triggering from the verified `main` branch. A second deployment must prove that content, sessions, media metadata, and menus survive without recreating or replacing D1/R2 resources.
