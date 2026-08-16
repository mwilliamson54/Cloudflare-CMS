# Deploying Atelier CMS to Cloudflare Pages

This guide deploys **Atelier CMS** as a Cloudflare Pages application with Pages Functions, D1, R2, KV, and a separate scheduled-publishing Worker. It presents two valid configuration routes:

1. **Wrangler TOML as source of truth**, suitable for version-controlled, reproducible infrastructure.
2. **Cloudflare dashboard bindings**, suitable when the Pages project is managed in the Cloudflare UI.

> **Choose one configuration authority for a Pages environment.** Once a Pages deployment includes a Wrangler configuration with `pages_build_output_dir`, Cloudflare treats the configuration file as the source of truth for these settings. Do not make competing dashboard edits to the same bindings. [1]

| Required Cloudflare resource | Binding name in this CMS | Purpose |
| --- | --- | --- |
| D1 database | `CMS_DB` | Content, users, taxonomies, token hashes, settings, menus, SEO data, themes, plugins, and media metadata. |
| R2 bucket | `CMS_MEDIA` | Original media bytes only. Object keys use `uploads/YYYY/MM/u{userId}/...`. |
| KV namespace | `CMS_CACHE` | Reserved for the declared cache contract and future edge cache coordination. |
| Pages secret | `CMS_JWT_SECRET` | HS256 secret used by the programmatic WordPress-style REST token verifier. |
| Pages variable | `CMS_ORIGIN` | Canonical public origin, for example `https://journal.example.com`. |
| Pages variable | `CMS_TOKEN_TTL_SECONDS` | Default REST token lifetime; the current configuration uses `2592000` (30 days). |
| Scheduled Worker D1 binding | `CMS_DB` | Promotes due scheduled content without touching trashed records. |

The application already includes `wrangler.jsonc` and `wrangler.scheduler.jsonc`. The TOML in this document is an equivalent **alternative**, not an extra file to add beside an active `wrangler.jsonc`.

## 1. Prerequisites

Prepare a Cloudflare account with Workers/Pages access and a local checkout of this repository. Install Node.js 22 or later and pnpm 10, then install dependencies and authenticate Wrangler.

```bash
cd cloudflare-fashion-cms
pnpm install --frozen-lockfile
pnpm dlx wrangler login
pnpm check
pnpm test
pnpm build:pages
```

The Pages static build command is `pnpm build:pages`, which writes the deployable frontend to `client/dist`. The `/functions` directory is uploaded with Pages and provides REST, sitemap, robots, media, and edge metadata behavior.

Before touching production, create an isolated **preview** D1 database, R2 bucket, and KV namespace if editorial testing must not share production data. Pages supports both preview and production bindings. [2]

## 2. Create Cloudflare Resources

Run these commands once per environment. Names are examples; use names that follow your account’s conventions.

```bash
# D1: retain the returned database_id.
pnpm dlx wrangler d1 create atelier-cms

# R2: private object storage for original CMS assets.
pnpm dlx wrangler r2 bucket create atelier-cms-media

# KV: retain the returned namespace id.
pnpm dlx wrangler kv namespace create CMS_CACHE
```

For a distinct preview environment, create separate resources:

```bash
pnpm dlx wrangler d1 create atelier-cms-preview
pnpm dlx wrangler r2 bucket create atelier-cms-preview-media
pnpm dlx wrangler kv namespace create CMS_CACHE --preview
```

Record each D1 database ID and KV namespace ID securely. An R2 binding uses the bucket name; it does not require a bucket ID in the Pages configuration.

## 3. Apply D1 Migrations Safely

The repository’s D1 migration sequence is deliberately ordered:

| File | Change |
| --- | --- |
| `migrations/0001_cms_core.sql` | Core users, content types/entries, taxonomies, media metadata, settings, menus, and API-token tables. |
| `migrations/0002_content_trash.sql` | Separate `trashed_at` lifecycle marker. |
| `migrations/0003_appearance_records.sql` | Persisted bundled-theme and plugin records. |
| `migrations/0004_scale_indexes.sql` | Public-listing, scheduler, sitemap, uploader-media, and reverse-taxonomy indexes. |

Cloudflare D1 tracks applied migration versions in its migration table and applies remaining SQL files in sequence. [3] Use the immutable D1 **database name** in production commands where possible, because a binding name can later be changed. [3]

### Local migration dry run

Run locally first. This uses Wrangler’s local D1 storage and does not affect Cloudflare production.

```bash
pnpm dlx wrangler d1 migrations apply atelier-cms --local
```

### Production migration

Review the pending migration names, then apply them remotely.

```bash
pnpm dlx wrangler d1 migrations list atelier-cms --remote
pnpm dlx wrangler d1 migrations apply atelier-cms --remote
pnpm dlx wrangler d1 migrations list atelier-cms --remote
```

Do **not** run Drizzle’s MySQL migration command against D1. This repository uses dedicated SQLite/D1 SQL under `migrations/`. Do not edit a migration after it has been applied to any shared environment; add the next numbered migration instead.

> Existing convenience script `pnpm cf:d1:migrate` executes only the baseline `0001_cms_core.sql`. It is useful for a fresh bootstrap only. Use `wrangler d1 migrations apply` for the complete tracked sequence and for every subsequent deployment.

## 4. Route A — Wrangler TOML Configuration

### 4.1 Switch deliberately from JSONC to TOML

The repository currently contains `wrangler.jsonc`. Use **either** that file **or** a file named `wrangler.toml`; do not leave two competing active Wrangler configuration files in the project root.

To use TOML, rename or remove the JSONC file in your deployment branch, then create `wrangler.toml` with your real IDs. Preserve the binding names exactly because the Pages Functions refer to `CMS_DB`, `CMS_MEDIA`, and `CMS_CACHE`.

```toml
"$schema" = "node_modules/wrangler/config-schema.json"
name = "atelier-cms"
compatibility_date = "2026-08-14"
pages_build_output_dir = "client/dist"

[[d1_databases]]
binding = "CMS_DB"
database_name = "atelier-cms"
database_id = "REPLACE_WITH_D1_DATABASE_ID"
migrations_dir = "migrations"

[[r2_buckets]]
binding = "CMS_MEDIA"
bucket_name = "atelier-cms-media"

[[kv_namespaces]]
binding = "CMS_CACHE"
id = "REPLACE_WITH_KV_NAMESPACE_ID"

[vars]
CMS_ORIGIN = "https://journal.example.com"
CMS_TOKEN_TTL_SECONDS = "2592000"

[env.preview]

[[env.preview.d1_databases]]
binding = "CMS_DB"
database_name = "atelier-cms-preview"
database_id = "REPLACE_WITH_PREVIEW_D1_DATABASE_ID"
migrations_dir = "migrations"

[[env.preview.r2_buckets]]
binding = "CMS_MEDIA"
bucket_name = "atelier-cms-preview-media"

[[env.preview.kv_namespaces]]
binding = "CMS_CACHE"
id = "REPLACE_WITH_PREVIEW_KV_NAMESPACE_ID"

[env.preview.vars]
CMS_ORIGIN = "https://preview.journal.example.com"
CMS_TOKEN_TTL_SECONDS = "2592000"
```

Pages supports TOML and JSON/JSONC Wrangler configuration. A Pages config requires `name`, `pages_build_output_dir`, and a compatibility date. [1] D1, R2, and KV bindings are non-inheritable configuration keys: when you override one in an environment, declare the complete relevant set for that environment. [1]

### 4.2 Store the JWT secret outside TOML

Never put the real JWT signing secret in `[vars]`, the repository, or a committed `.env` file. Set it as a Pages secret:

```bash
# Production secret
pnpm dlx wrangler pages secret put CMS_JWT_SECRET --project-name atelier-cms

# Preview secret, if preview uses a separate Pages project or secret scope
pnpm dlx wrangler pages secret put CMS_JWT_SECRET --project-name atelier-cms
```

Generate a high-entropy random value, for example:

```bash
openssl rand -base64 48
```

Do not rotate this value casually. Existing REST tokens become invalid if the signing key changes; plan a revocation and reissue window.

### 4.3 Deploy Pages with TOML

```bash
pnpm build:pages
pnpm dlx wrangler pages deploy client/dist --project-name atelier-cms --branch main
```

For Git integration, commit the TOML configuration, set the build command to `pnpm build:pages`, set the build output directory to `client/dist`, and configure `main` as the production branch. A deployment that carries a Wrangler file applies the declared Pages configuration. [1]

## 5. Route B — Cloudflare Dashboard Configuration

Use this route when you want the Cloudflare UI, rather than a repository file, to own Pages bindings. Do not deploy an alternative Wrangler file with `pages_build_output_dir` afterward unless you intentionally migrate configuration authority. [1]

### 5.1 Create or connect the Pages project

1. In Cloudflare, open **Workers & Pages**.
2. Select **Create application** → **Pages**.
3. Connect the Git repository or choose a direct upload project.
4. Set **Build command** to `pnpm build:pages`.
5. Set **Build output directory** to `client/dist`.
6. Set the production branch, normally `main`.
7. Deploy once to establish the project.

### 5.2 Add production bindings

Open **Workers & Pages** → **atelier-cms** → **Settings** → **Bindings**. Choose the **Production** environment and add each binding:

| Binding type in dashboard | Variable name | Select this resource |
| --- | --- | --- |
| D1 database | `CMS_DB` | The production `atelier-cms` D1 database. |
| R2 bucket | `CMS_MEDIA` | The production `atelier-cms-media` bucket. |
| KV namespace | `CMS_CACHE` | The production CMS cache namespace. |

For each binding, select **Add**, choose the resource, and save. Cloudflare requires a new deployment before a changed Pages binding becomes active. [2]

Repeat the binding process under the **Preview** environment if preview should use isolated resources. Do not point preview at production media or the production D1 database unless that is a conscious editorial policy.

### 5.3 Add variables and secret

Open **Settings** → **Environment variables** for the production environment.

| Name | Type | Example |
| --- | --- | --- |
| `CMS_ORIGIN` | Plaintext variable | `https://journal.example.com` |
| `CMS_TOKEN_TTL_SECONDS` | Plaintext variable | `2592000` |
| `CMS_JWT_SECRET` | **Encrypted secret** | A 32-byte-or-longer random value. |

Add corresponding preview values if preview is configured. Redeploy after changing bindings or variables.

## 6. Deploy the Scheduled-Publishing Worker

Pages does not run a cron trigger by itself. The repository includes `workers/scheduler.ts` and `wrangler.scheduler.jsonc`; it queries `CMS_DB` every five minutes and publishes only due, non-trashed scheduled records.

Replace `REPLACE_WITH_D1_DATABASE_ID` in `wrangler.scheduler.jsonc`, then deploy:

```bash
pnpm dlx wrangler deploy --config wrangler.scheduler.jsonc
```

If you converted the Pages configuration to TOML, you may keep the scheduler JSONC file because it is a **separate Worker** configuration. Alternatively, create an equivalent `wrangler.scheduler.toml` with `main = "workers/scheduler.ts"`, the `CMS_DB` binding, and the cron trigger.

## 7. Post-deployment Verification

Check these routes on the production domain after every first deployment or material infrastructure change.

```bash
curl -I https://journal.example.com/robots.txt
curl -I https://journal.example.com/sitemap.xml
curl -I https://journal.example.com/api/wp/v2/posts
curl -I https://journal.example.com/media/not-a-real-key
```

Then sign into `/admin`, create a draft, upload a small WebP image, and confirm that the record appears in the media library. Publish a test post, verify it appears in `/blog` and `/sitemap.xml`, then trash and permanently delete it. The public routes should never expose a draft or trashed entry.

## 8. Operational Checklist

| Check | Expected result |
| --- | --- |
| D1 migrations | `wrangler d1 migrations list ... --remote` shows no unapplied migration. |
| Pages bindings | Production has exactly `CMS_DB`, `CMS_MEDIA`, and `CMS_CACHE` with intended production resources. |
| Secrets | `CMS_JWT_SECRET` is encrypted and never committed. |
| R2 | Objects are written through CMS upload flows; no binary media is inserted into D1. |
| Scheduler | `atelier-cms-scheduler` is deployed and its cron trigger is enabled. |
| Canonical origin | `CMS_ORIGIN` matches the final HTTPS custom domain, without a trailing path. |
| REST | Bearer tokens are issued in CMS, not copied from a browser session. |
| Rollback | A prior Pages deployment and database backup/export plan are identified before production schema changes. |

## 9. Troubleshooting

| Symptom | Likely cause | Resolution |
| --- | --- | --- |
| `CMS_DB` is undefined in a Function | Binding name mismatch or project not redeployed. | Confirm exact uppercase binding name and redeploy Pages. |
| REST returns `cms_unauthorized` | Missing/incorrect `CMS_JWT_SECRET`, expired/revoked token, or wrong scope. | Re-enter the secret, redeploy, then issue a fresh CMS API token with the needed scope. |
| Media upload succeeds locally but fails in Pages | Missing `CMS_MEDIA` R2 binding or a bucket in the wrong account. | Bind the production R2 bucket to `CMS_MEDIA` and redeploy. |
| Old schema error after deploy | Migrations were not applied remotely. | Run `wrangler d1 migrations list` and `apply` against the production database. |
| Scheduler does not publish due content | Scheduler Worker has the wrong D1 ID or was not deployed. | Update `wrangler.scheduler.jsonc`, deploy the Worker, and inspect Worker logs. |
| Dashboard changes disappear after deployment | A Wrangler configuration is now source of truth. | Make the change in the chosen config file, or intentionally migrate back to dashboard ownership. [1] |

## References

[1]: https://developers.cloudflare.com/pages/functions/wrangler-configuration/ "Cloudflare Pages Functions — Wrangler configuration"
[2]: https://developers.cloudflare.com/pages/functions/bindings/ "Cloudflare Pages Functions — Bindings"
[3]: https://developers.cloudflare.com/d1/reference/migrations/ "Cloudflare D1 — Migrations"

## Production Admin Authentication on Pages

The Cloudflare build now includes an additive `migrations/0005_auth_sessions.sql` migration and a Pages Function at `/api/auth/*`. The route provides one-time administrator bootstrap, password login, session inspection, and CSRF-protected logout. Passwords use salted PBKDF2-SHA-256 records; browser sessions use an HttpOnly `cms_session` cookie plus a non-HttpOnly `cms_csrf_token` double-submit cookie. Sessions are stored in D1 and expire after seven days unless revoked.

Apply migration `0005_auth_sessions.sql` only after the preceding migrations have been applied in order. Configure `CMS_AUTH_BOOTSTRAP_SECRET` as a Cloudflare Pages production secret, use it once to create the first administrator, and remove or rotate it immediately afterward. Never place this value in `wrangler.jsonc`, GitHub, client code, or a public build log.

The auth/session backend is production-oriented, but the current repository still needs the complete Pages-compatible adapter for the local Express/tRPC administration procedures before the full `/admin` dashboard can be declared production-functional. Do not expose the dashboard publicly until those procedures are available under Pages and verified against the same D1 binding.

Example first-admin bootstrap request after the migration and secret are configured:

```bash
curl -X POST https://YOUR-PAGES-DOMAIN.example/api/auth/bootstrap \
  -H 'content-type: application/json' \
  --data '{"bootstrapSecret":"REDACTED","email":"admin@example.com","name":"Administrator","password":"REPLACE_WITH_A_12_CHARACTER_PASSWORD"}'
```

Then test login without printing the returned cookies to shared logs:

```bash
curl -i -c cookies.txt -X POST https://YOUR-PAGES-DOMAIN.example/api/auth/login \
  -H 'content-type: application/json' \
  --data '{"email":"admin@example.com","password":"REPLACE_WITH_A_12_CHARACTER_PASSWORD"}'
```

The current implementation is intentionally additive and does not modify existing content, media, taxonomy, settings, or token records. The production release gate remains: **same D1 binding, R2 enabled and bound, authentication verified, complete admin adapter verified, then publish**.
