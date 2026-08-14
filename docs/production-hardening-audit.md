# Production-Hardening Audit

**Status:** Rolling implementation audit, 14 August 2026

This audit records the state of the existing CMS before hardening changes. The existing application is being extended incrementally; working routes, data models, and the fashion theme are preserved.

| Area | Current state | Assessment |
| --- | --- | --- |
| Roles | `admin`, `editor`, `author`, `contributor`, `subscriber`, and `viewer` are enforced through a centralized capability map. | **Implemented with ongoing coverage expansion.** Administrator user management and self-demotion protections are in place. |
| Content | Posts, pages, custom types, lifecycle statuses, taxonomies, API tokens, page hierarchy, templates, protected previews, deletion, and content-level SEO fields are persisted. | **Implemented with expanded regression coverage.** Router-level tests now cover authored post creation, page/custom-entry creation contracts, publication permissions, rich-HTML sanitization, ownership enforcement, update, and deletion. Additional integration coverage remains. |
| Media | The development adapter uploads bytes through a server-side S3-compatible presigned storage helper; metadata is persisted in `media`. | **Implemented.** The library validates uploads, supports metadata editing and stable-ID replacement, and never stores binary data in the database. |
| R2 delivery | The Pages Function writes and reads objects through the `CMS_MEDIA` R2 binding and serves immutable cache headers. | **Implemented for upload, read, and authenticated stable-ID replacement.** Thumbnail derivatives remain a scalability enhancement. |
| REST API | Collections for posts, pages, media, categories, and tags exist under `/api/wp/v2/*`; JWT API tokens are hashed and revocable. | **Implemented baseline with contract coverage.** Local adapter tests now verify published-only collections, search/pagination headers, unpublished individual-resource exclusion, authenticated publication using the JWT subject as author, and WordPress-shaped error responses. Broader Pages Functions parity remains. |
| Frontend | The fashion magazine uses published-content queries with archive, category, search, article, and protected preview routes. | **Implemented with ongoing cache-flow verification.** |
| SEO | CMS fields, client metadata helper, sitemap and robots routes exist. | **Implemented baseline.** Canonical, robots, JSON-LD, site-wide indexing, and per-entry Open Graph title/description overrides are wired. Local route tests now verify that sitemap rows originate from published-only collections, exclude `robotsIndex=false` entries, and bypass content reads when site-wide indexing is disabled; crawler-visible server rendering remains. |
| Plugins | A hook registry, documentation, and a reading-time plugin exist. | **Implemented for bundled plugins.** The Appearance workspace persists an administrator-controlled allowlist, gates public hooks and plugin editor blocks from that setting, and deliberately excludes arbitrary third-party executable-code uploads. |
| Cloudflare | Pages Functions, D1 migration, R2 media route, KV declaration, and a scheduled Worker configuration exist. | **Partial.** The local Express adapter is not a deployment target; final audit must confirm Worker compatibility and free-plan operating limits. |

## Confirmed Storage Flow

> The database stores **media metadata only**: key, URL, filename, MIME type, bytes, dimensions, alt text, title, caption, description, uploader, and timestamps. It does not store media bytes.

The current development storage helper requests a server-side S3-compatible presigned upload URL from the managed storage service, uploads the supplied bytes, and persists only the returned key/URL. The Pages deployment path writes and reads objects through the `CMS_MEDIA` R2 binding with cacheable response headers. The CMS now models these through an explicit provider contract: the local adapter is `s3-compatible`; the production Pages REST adapter persists `cloudflare-r2`. Neither storage secret is exposed to frontend JavaScript.

## Priority Hardening Sequence

The first priority is authorization: extend the role enum and capability matrix, enforce ownership for author/contributor content, and add administrator-only role management. The next priority is media and R2 write support, followed by protected previews, template selection, REST compatibility, SEO analysis, scalability, and security testing.

The scheduled Worker configuration was compiled in a no-deploy Cloudflare dry run after this audit was started. It resolved the `CMS_DB` binding and produced a deployable worker bundle without publishing anything.

## Role Compatibility Mapping

The persisted role key **`admin`** is intentionally retained as the WordPress **Administrator** equivalent to avoid breaking existing users, the original CMS contract, and existing API tokens. The administration UI presents this as **Administrator**. The full role set is therefore `admin` (Administrator), `editor`, `author`, `contributor`, `subscriber`, and `viewer` (a legacy read-only compatibility level). Only `admin` can list users or change roles; an administrator cannot demote their own account.

## Regression Evidence Added in This Increment

The test suite now includes dedicated router-level lifecycle assertions for `post`, `page`, and custom content types. It verifies the authenticated author is persisted as owner, authors may publish while contributors cannot, HTML supplied from visual/source authoring paths is sanitized before persistence, and authors are denied mutation of another author’s entry while editors retain cross-author editorial authority. The local sitemap route is also tested for published-only query intent, entry-level noindex exclusion, and the site-wide indexing kill switch.

These tests intentionally exercise the public contracts and permission boundary rather than reproduce the repository implementation. Full D1/Pages Functions integration testing, server-rendered crawler metadata, and end-to-end REST publication verification remain tracked separately.

## Controlled Appearance Configuration

The administration sidebar now exposes a dedicated **Appearance** workspace for `admin` users. It presents the bundled Fashion Editorial theme as the active public theme and lets an administrator activate or deactivate the bundled Reading Time plugin. The configuration is stored in `site_settings` as `theme` and `enabledPlugins`; the D1 baseline seeds both values, so Pages deployments receive the same default configuration.

The plugin setting is an explicit allowlist rather than a plugin upload channel. On every public post query, the hook bus applies only registered filters whose plugin keys are enabled in that setting. The content editor similarly hides plugin-provided blocks when the plugin is inactive. This enables operational control while retaining a strict trusted-code boundary: unreviewed plugin keys fail schema validation, and only administrators have the `site:manage` capability required to read or change the configuration.

## REST Contract Evidence Added

The local WordPress-style adapter now has end-to-end HTTP contract tests. They confirm that post collections request only published content, preserve `search`, `page`, and `per_page` inputs, return `X-WP-Total` and `X-WP-TotalPages`, and render WordPress-compatible response fields. They also verify individual drafts are treated as non-public, missing resources use the expected `rest_post_invalid_id` error shape, and an authenticated post creation attaches the verified token subject as author before emitting a `201` response.
