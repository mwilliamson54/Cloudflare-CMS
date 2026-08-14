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

The administration sidebar now exposes a dedicated **Appearance** workspace for `admin` users. The first deployment deliberately operates in **bundled single-theme mode**: Fashion Editorial is the immutable public theme, while the theme key remains seeded as deployment metadata for a future reviewed theme registry. The workspace lets administrators activate or deactivate the bundled Reading Time plugin; it does not present a non-functional theme switcher. The D1 baseline seeds both `theme` and `enabledPlugins`, so Pages deployments receive the same default configuration.

The public header, footer, newsletter, homepage, archive, article, and protected-preview flows now import theme assets only through the bundled-theme runtime boundary. The header, footer, newsletter, and homepage resolve their presentation using public site metadata; archive, article, and preview flows use the same reviewed runtime module for the bundled single-theme assets. The resolver returns Fashion Editorial for the configured key and safely falls back to Fashion Editorial for missing or unsupported deployment metadata. This preserves a stable single-theme public shell today while defining the controlled resolver point where future reviewed themes can be registered.

The plugin setting is an explicit allowlist rather than a plugin upload channel. On every public post query, the hook bus applies only registered filters whose plugin keys are enabled in that setting. The content editor similarly hides plugin-provided blocks when the plugin is inactive. This enables operational control while retaining a strict trusted-code boundary: unreviewed plugin keys fail schema validation, and only administrators have the `site:manage` capability required to read or change the configuration.

## REST Contract Evidence Added

The local WordPress-style adapter now has end-to-end HTTP contract tests. They confirm that post collections request only published content, preserve `search`, `page`, and `per_page` inputs, return `X-WP-Total` and `X-WP-TotalPages`, and render WordPress-compatible response fields. They also verify individual drafts are treated as non-public, missing resources use the expected `rest_post_invalid_id` error shape, and an authenticated post creation attaches the verified token subject as author before emitting a `201` response.

Authenticated REST updates now load the existing entry before mutation and apply the same author/contributor ownership boundary used by the administrative router. `DELETE /api/wp/v2/posts/:id` and `/pages/:id` provide a documented permanent-deletion envelope (`deleted` plus `previous`) rather than an unimplemented trash state. Contract tests verify cross-author update denial and an owned-entry deletion response.

The public site router now has complementary visibility coverage: public post lists preserve their search/pagination inputs while requesting published content only, public pages request published entries only, and an unavailable post slug resolves to `null` rather than exposing scheduled, draft, or archived records. This closes the public query boundary around the existing lifecycle-status enforcement while fuller database-backed scheduled and custom-entry integration tests remain tracked.

Category archives now have the same explicit regression evidence: the route requests a published-only post set before applying the category relationship filter. Scheduled and archived entries therefore cannot enter the category view through a different public query path. Full database-backed lifecycle fixtures and custom-entry administration flows remain tracked separately.

Public tag archives now use the equivalent `site.tagPosts` contract, request published posts before filtering tag relationships, and render at `/tag/:slug` through the fashion archive shell. The new route has regression coverage for the published-only query input and visual verification for its empty and populated-layout boundary.

The Cloudflare scheduled worker now has direct regression coverage for its promotion statement. Each run issues one guarded D1 update that transitions only rows with `status = 'scheduled'`, a non-null due timestamp, and `scheduled_at <= now`; it sets the publication timestamp from the scheduled value. The public query contracts therefore keep scheduled records private until the idempotent promotion succeeds, after which homepage, archive, category, search, REST, and sitemap readers use their existing published-only filters.

## Query-Shape Scalability Increment

Paginated content listings no longer hydrate categories and tags with two additional queries per entry. The repository now retrieves all category relationships and all tag relationships for the current page in two batched relation queries, groups them by entry ID, and preserves the existing entry contract. Consequently, a page of up to 100 entries has a bounded taxonomy-query shape rather than scaling linearly with the number of rows. Existing composite content-status/publication indexes, unique type-and-slug lookup, media creation ordering, and sitemap URL cap remain in place; full-text search and keyset pagination are retained as future scale-stage work.

## Security Boundary Review

CMS mutations use the authenticated application session for the administration interface and JWT bearer tokens with scope/capability validation for the WordPress-compatible REST API. The plugin model remains repository-only and allowlisted: no marketplace, runtime package upload, custom executable-code setting, or server-side plugin uploader is available. Visual and HTML-source authoring are content channels only; submitted HTML is allowlist-sanitized before persistence and source previews are sandboxed.

The protected tRPC administration path now applies an explicit same-origin guard before routing a request into the CMS API. Browser-supplied `Origin` headers must match the receiving host; malformed or cross-origin requests receive a `403` response. OAuth callback completion issues a random, non-HttpOnly companion CSRF cookie, and the tRPC client returns that value in an `x-csrf-token` header. Cookie-authenticated tRPC requests must present an exact double-submit match or receive `403`; origin-less bearer-session fallback requests and the WordPress-compatible REST API retain their separate bearer-token authentication models. No custom head/body/CSS/JS execution settings are exposed in the current administration UI; this is intentional until a separately reviewed trust model and CSP strategy are implemented.

Viewer-level mutation regression coverage now spans content creation and deletion, token issuance, menu changes, media metadata changes, taxonomy creation, site settings, bundled-plugin configuration, and user role updates. These calls consistently fail at the capability boundary before touching storage or persistence. Higher-privilege ownership and publication tests remain separately covered in the content lifecycle and user-management suites.

The origin guard is regression-tested both as a pure contract and as mounted Express middleware. Request-level tests prove that a cookie-authenticated same-origin write reaches the handler only with a matching double-submit header/cookie pair, while missing or invalid tokens and hostile origins receive `403` before the write handler executes. It provides an explicit baseline for the current single-origin administration deployment; any future intentionally cross-origin CMS integration must use a reviewed request-authentication protocol rather than bypassing this guard.

## Media Delivery Review

R2 media uses stable year/month/user object keys, metadata-only database records, server-side MIME and size validation, and immutable delivery caching. The administration UI processes a multi-file queue without aborting successful neighboring uploads after one failure; the practical retry operation is reselecting or re-dropping the individual failed file. Original-only delivery is intentional in the first free-tier deployment. The documented derivative strategy defers thumbnails to a controlled write-time pipeline rather than adding on-demand transformation cost or runtime work.

## SEO Delivery Boundary

Public article pages currently set title, description, canonical, robots, Open Graph fields, and Article JSON-LD through the client metadata component after the application hydrates. Dynamic `sitemap.xml` and `robots.txt` are delivered by server/Pages routes and already honor publication state, entry-level noindex, and the site-wide indexing setting. The metadata component is sufficient for interactive browser rendering, but it does not make per-entry metadata present in the initial HTML response. Crawler-visible metadata and social preview parity therefore require a future SSR or edge HTML-rewrite conversion; this remains explicitly open rather than represented as complete SEO delivery.

Administrators now also receive a bounded aggregate SEO summary in the dashboard. The `cms.seo.summary` contract examines at most 100 recent posts (50 by default), reuses the deterministic per-entry analysis, and reports sample size, average score, high-priority recommendation count, and the five most frequent recommendations. It deliberately avoids unbounded publication scans and does not retain post body data in the aggregate result.

## Structured Markdown Authoring

The Markdown mode now treats the article body as an ordered sequence of portable Markdown blocks. Editors can insert registered core or enabled-plugin blocks, edit each block independently, move it up or down, and remove it without hand-managing separator syntax. The persisted format remains ordinary Markdown separated by blank lines, so REST responses, previews, extensions, and export paths retain a stable text contract. Visual and source-HTML modes remain available; source-mode previews stay sandboxed and all supplied HTML continues to pass through the server-side allowlist sanitizer before persistence.

Lifecycle regression coverage now additionally proves protected draft-preview ownership: an author can retrieve their own draft through the protected preview contract, while another author receives a forbidden response. This complements the existing create/update sanitizer assertions for visual/source HTML. Browser-level mode-switching and sandbox-frame interaction coverage remain an open integration-test item.

Protected preview rendering now resolves the supported `default`, `landing`, `narrative`, `lookbook`, and `minimal` template keys through a deterministic shared contract. The resolver changes headline scale, editorial eyebrow, content measure, hero image treatment, and whether a hero image is shown; unsupported keys fall back safely to the default presentation. Unit coverage verifies every configured presentation branch, while the preview route continues to enforce ownership and noindex behavior.
