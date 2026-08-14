# Production-Hardening Audit

**Status:** Initial implementation audit, 14 August 2026

This audit records the state of the existing CMS before hardening changes. The existing application is being extended incrementally; working routes, data models, and the fashion theme are preserved.

| Area | Current state | Assessment |
| --- | --- | --- |
| Roles | `admin`, `editor`, and `viewer` are enforced by a centralized capability map. | **Partial.** WordPress-style author, contributor, and subscriber levels plus user administration are absent. |
| Content | Posts, pages, custom types, lifecycle statuses, taxonomies, API tokens, and content-level SEO fields are persisted. | **Partial.** Ownership restrictions, page hierarchy, templates, preview URLs, and structured visual/source editing need hardening. |
| Media | The development adapter uploads bytes through a server-side S3-compatible presigned storage helper; metadata is persisted in `media`. | **Partial.** This is not a local-file or database-binary design. The Cloudflare adapter has an R2 binding and serves `functions/media/[[key]].ts`, but the upload path still needs to target R2 directly in production. |
| R2 delivery | The Pages Function obtains a key from the `CMS_MEDIA` R2 binding and returns object data with immutable cache headers. | **Present for reads.** The production upload adapter, safer key architecture, validation, and thumbnail strategy still need completion. |
| REST API | Collections for posts, pages, media, categories, and tags exist under `/api/wp/v2/*`; JWT API tokens are hashed and revocable. | **Partial.** Resource endpoints, users, menus, settings, WordPress response compatibility, pagination/filter coverage, and contract tests require expansion. |
| Frontend | The fashion magazine uses published-content queries with archive, category, search, and article routes. | **Partial.** Preview rendering, template selection, crawler-visible metadata, cache invalidation, and related-content handling need verification. |
| SEO | CMS fields, client metadata helper, sitemap and robots routes exist. | **Partial.** Per-entry Open Graph delivery, structured data, crawler-visible rendering, analysis/recommendations, and test coverage are outstanding. |
| Plugins | A hook registry, documentation, and a reading-time plugin exist. | **Partial.** Lifecycle permissions, trusted-plugin policy, and removal testing must be documented and verified. |
| Cloudflare | Pages Functions, D1 migration, R2 media route, KV declaration, and a scheduled Worker configuration exist. | **Partial.** The local Express adapter is not a deployment target; final audit must confirm Worker compatibility and free-plan operating limits. |

## Confirmed Storage Flow

> The database stores **media metadata only**: key, URL, filename, MIME type, bytes, dimensions, alt text, title, caption, description, uploader, and timestamps. It does not store media bytes.

The current development storage helper requests a server-side S3-compatible presigned upload URL from the managed storage service, uploads the supplied bytes, and persists only the returned key/URL. The Pages deployment path writes and reads objects through the `CMS_MEDIA` R2 binding with cacheable response headers. The CMS now models these through an explicit provider contract: the local adapter is `s3-compatible`; the production Pages REST adapter persists `cloudflare-r2`. Neither storage secret is exposed to frontend JavaScript.

## Priority Hardening Sequence

The first priority is authorization: extend the role enum and capability matrix, enforce ownership for author/contributor content, and add administrator-only role management. The next priority is media and R2 write support, followed by protected previews, template selection, REST compatibility, SEO analysis, scalability, and security testing.

The scheduled Worker configuration was compiled in a no-deploy Cloudflare dry run after this audit was started. It resolved the `CMS_DB` binding and produced a deployable worker bundle without publishing anything.

## Role Compatibility Mapping

The persisted role key **`admin`** is intentionally retained as the WordPress **Administrator** equivalent to avoid breaking existing users, the original CMS contract, and existing API tokens. The administration UI presents this as **Administrator**. The full role set is therefore `admin` (Administrator), `editor`, `author`, `contributor`, `subscriber`, and `viewer` (a legacy read-only compatibility level). Only `admin` can list users or change roles; an administrator cannot demote their own account.
