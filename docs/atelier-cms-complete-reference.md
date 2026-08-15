# Atelier CMS Complete Project Reference

**Atelier CMS** is a Cloudflare-native, WordPress-inspired editorial content management system. It provides a fashion-magazine public site as its first bundled presentation layer while keeping the content model, roles, REST API, media pipeline, theme boundary, and extension hooks general-purpose.

This document explains what the CMS does, its prerequisites and technology stack, each implemented feature area, the important implementation logic behind it, and the operational boundaries that keep it suitable for a Cloudflare Pages free-tier deployment.

## 1. Product Scope

Atelier CMS is not a static-site generator with an isolated admin mockup. Editors create and update records in the CMS; those records control public archive, article, page, taxonomy, search, sitemap, metadata, media, and configuration output. Programmatic publishers can use WordPress-shaped endpoints under `/api/wp/v2/*` with JWT bearer tokens.

| Goal | CMS implementation |
| --- | --- |
| General-purpose CMS core | Content types, flexible field definitions, posts, pages, custom entries, taxonomies, settings, menus, media, themes, and plugins are separate persisted concepts. |
| Fashion magazine launch site | The bundled **Fashion Editorial** theme renders a homepage, archive, article, page, category, tag, search, and newsletter/footer shell. |
| Cloudflare-first deployment | Pages Functions handle REST, media delivery, sitemap, robots, and edge metadata; D1 stores relational state; R2 stores binary media; KV is reserved for safe cache coordination; a Worker cron promotes scheduled content. |
| WordPress-style publishing compatibility | REST resource paths, pagination headers, content shapes, statuses, taxonomy IDs, media records, and WordPress-style error envelopes are provided where they are meaningful and safe. |
| Security and maintainability | Centralized roles/capabilities, ownership checks, CSRF, same-origin administration, token revocation, restrictive HTML sanitization, controlled CSS, immutable theme/plugin boundaries, and extensive tests. |

## 2. Prerequisites

### Development prerequisites

| Requirement | Why it is required |
| --- | --- |
| Node.js 22+ | Runs the TypeScript tooling, Vite build, test runner, and local Express adapter. |
| pnpm 10+ | Uses the locked dependency graph in `pnpm-lock.yaml`. |
| A MySQL-compatible development database | Supports the local Drizzle-backed repository used by the full-stack development adapter. |
| Cloudflare account | Required for production Pages, D1, R2, KV, and scheduler Worker resources. |
| Wrangler CLI | Creates Cloudflare resources, applies D1 migrations, deploys Pages, and deploys the scheduler. |
| A configured Manus OAuth application for the dashboard | Provides the CMS browser-session authentication flow in the local/full-stack adapter. |

### Production prerequisites

Production needs a D1 database, R2 bucket, KV namespace, `CMS_JWT_SECRET`, canonical `CMS_ORIGIN`, and a deployed scheduled-publishing Worker. The full deployment procedure is in [`cloudflare-d1-pages-deployment.md`](cloudflare-d1-pages-deployment.md).

> D1 is the relational source of truth for metadata and relationships. R2 is the source of truth for binary file bytes. The CMS never stores image or document binaries in a database column.

## 3. Technology Stack

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Authoring UI | React 19, TypeScript, Tailwind CSS 4, Radix/shadcn components | Accessible editorial dashboard and fashion frontend. |
| Client routing/data | Wouter, tRPC 11, TanStack Query | Route delivery and typed client/server administration procedures. |
| Local application adapter | Express 4, Vite 7, SSR entry | Development server, local REST adapter, public SSR, and browser testing environment. |
| Data access | Drizzle ORM, MySQL-compatible development database | Development repository and schema contract. |
| Cloudflare persistence | D1, R2, KV | Production relational data, original media objects, and declared cache boundary. |
| Cloudflare edge | Pages Functions, HTMLRewriter, Worker Cron | REST/media/sitemap/robots handlers, crawler metadata, scheduled publication. |
| Validation | Zod, custom rich-HTML/CSS/media validators | Schema inputs, content safety, upload type/size limits, CSS restrictions. |
| Token cryptography | `jose`, Web Crypto in Pages Function | HS256 JWT issuance/verification and hash-based token persistence. |
| Testing | Vitest, Playwright | Unit, router, real-repository integration, anonymous browser smoke, and authenticated browser coverage. |

## 4. Architecture and Request Paths

```text
Browser / REST client
        |
        +-- Public site routes --> React fashion runtime --> public site router --> repository
        |
        +-- /admin -----------> React dashboard --> tRPC --> CMS router --> repository
        |
        +-- /api/wp/v2/* ----> Local Express adapter OR Pages Function --> D1/R2
        |
        +-- /media/* --------> Pages media Function --> R2 object body
        |
        +-- /sitemap.xml ----> sitemap Function / local route --> D1 public records
        |
        +-- public HTML -----> local SSR / Pages HTMLRewriter --> escaped per-route metadata

D1: records, relationships, settings, menus, hashed API tokens
R2: original media bytes
KV: declared cache integration boundary
Scheduler Worker: due scheduled entries -> published, idempotently
```

The local adapter exists for productive development and testability. In Cloudflare production, Pages Functions and the Pages HTMLRewriter execute the public platform-specific paths; no Node Express server is expected inside Pages.

## 5. Content Model and Editorial Lifecycle

### 5.1 Content types and flexible fields

The `content_types` concept distinguishes built-in **post** and **page** types from administrator-defined custom types. A custom type declares a stable machine key, editorial label, and field definitions. Field definitions support text, textarea, number, date, boolean, select, and media semantics. The dashboard parses the compact `key:type:options` definition syntax and builds usable controls for records of that type.

Posts are designed for archives, categories, tags, search, and public articles. Pages have separate parent hierarchy and template selection. Custom entries retain lifecycle, SEO, media, and field data without forcing an architectural rewrite when a new niche is introduced.

### 5.2 Required statuses and soft trash

| State | Meaning | Public visibility |
| --- | --- | --- |
| `draft` | Editorial work in progress. | Never public. |
| `scheduled` | Ready for future publication at `scheduled_at`. | Never public until scheduler promotion. |
| `published` | Editorially released content. | Eligible for public routes and sitemap, subject to noindex. |
| `archived` | Kept internally but removed from public delivery. | Never public. |
| `trashed_at` set | A reversible removal marker independent of the required status. | Never public and never scheduler-promoted. |

Soft trash is intentionally not a fifth status. It preserves the original status and makes restoration deterministic. Default REST deletion sets `trashed_at`; `PATCH ?restore=true` clears it; `DELETE ?force=true` permanently removes content and taxonomy relations. Authors and contributors can only alter entries they own, while editors and administrators have their configured editorial authority.

### 5.3 Scheduling

`workers/scheduler.ts` is triggered every five minutes. It finds due `scheduled` entries, excludes trashed records, and promotes them idempotently. Re-running the schedule does not duplicate publication work. The scheduler has its own Cloudflare Worker configuration and only needs the `CMS_DB` D1 binding.

## 6. Administration Dashboard

The `/admin` workspace is a live CMS control plane, not a static mockup. It uses the persisted CMS tRPC procedures and follows the logged-in user’s capability set.

| Workspace | What the editor can do | Important implementation logic |
| --- | --- | --- |
| Overview | View editorial counts, health indicators, and workflow entry points. | Reads aggregate CMS state without changing public records. |
| Posts | Create, edit, schedule, publish, archive, trash, restore, or permanently delete stories. | Creation/update validates status and author capability; public caches/readers only observe published, non-trashed state. |
| Pages | Manage standalone pages, parent relationships, and page templates. | Parent lookup is published-only for public breadcrumbs; page hierarchy is intentionally separate from post archive behavior. |
| Content types | Define custom content models and fields. | Uses typed field definitions and dynamic controls rather than per-niche schema forks. |
| Taxonomies | Create/edit/delete hierarchical categories and flat tags. | Category deletion re-parents children safely; entry hydration avoids per-row taxonomy queries. |
| Media | Upload, browse, search, edit metadata, replace bytes while preserving ID, and delete references. | R2 holds bytes; D1 holds records; client and server both enforce MIME/size rules. |
| API tokens | Create, view once, revoke, and scope JWT tokens. | Only token hashes and token metadata persist; the raw secret is not retrievable after issuance. |
| Users | List users and change roles as an administrator. | Prevents unauthorized role changes and self-demotion lockout. |
| Settings | Manage site title/description, indexing, footer copy, public theme settings, and bounded custom CSS. | Global settings require `site:manage`; custom CSS undergoes server validation. |
| Menus | Edit header navigation items. | The public fashion shell queries persisted menu data; the configuration browser test verifies this end to end. |
| Appearance | Inspect the bundled Fashion Editorial theme and activate/deactivate the bundled Reading Time plugin. | Theme/plugin code is reviewed and bundled; no arbitrary ZIP or executable upload path exists. |

## 7. Four Authoring Modes

Atelier CMS keeps existing portable authoring options and adds a graphical block composition mode.

| Mode | Intended use | Storage behavior | Safety behavior |
| --- | --- | --- | --- |
| Structured Markdown | Portable text and simple composable markdown blocks. | Markdown segments are separated by blank lines. | Public renderer escapes/handles the textual body. |
| Visual | Lightweight contentEditable editing. | Captures HTML source into `bodyHtml`. | HTML is sanitized on the server before persistence. |
| HTML source | Advanced controlled editorial markup. | Stores sanitized `bodyHtml`. | Preview is an empty-sandbox iframe; scripts and unsafe constructs are removed. |
| Graphical blocks | Non-technical block composition. | Stores a portable block manifest in Markdown plus sanitized generated `bodyHtml`. | Images use the media library; embeds are allowlisted; widgets are structured data, not code. |

### 7.1 Graphical rich-content blocks

The graphical editor provides explicit buttons for headings, paragraphs, lists, tables, images, embeds, and widgets. Blocks may be reordered with drag-and-drop or keyboard-reachable move buttons. Each block has a stable client ID and is serialized in order.

| Block | Editor control | Stored/rendered form |
| --- | --- | --- |
| Heading | H1 through H6 selector and text field. | Semantic `<h1>`–`<h6>` and portable Markdown heading. |
| Paragraph | Rich text textarea. | Escaped paragraph HTML and plain portable text. |
| Lists | Bulleted/numbered toggle, addable rows. | `<ul>`/`<ol>` plus Markdown list syntax. |
| Tables | Editable headings/cells and add-row control. | Semantic table HTML plus Markdown table fallback. |
| Images | R2 media-library chooser or image drop/upload zone; alt/caption fields. | Persisted `/media/{key}` URL in a `<figure><img>` block. |
| Iframe embeds | URL and accessible title fields. | Sandboxed iframe only when the URL matches an approved HTTPS provider. |
| Custom widgets | Callout or editorial-note selector with title/body. | Semantic `<aside class="cms-widget ...">`; no JavaScript payload or arbitrary widget code. |

Graphical blocks generate two representations. `bodyMarkdown` carries an encoded block manifest followed by readable Markdown fallback. `bodyHtml` carries the semantic public HTML. The public post and page renderers prefer `bodyHtml` when available; older Markdown-only records continue to render unchanged.

### 7.2 Graphical image and R2 workflow

An image block accepts a selected existing library asset or a dropped/local image. New images are validated in the browser, base64 encoded for the existing authenticated CMS media mutation, and persisted by the media service. In production that service writes the bytes to R2 and returns a durable CMS media record. The editor then inserts the returned stable media URL, accessible alternative text, and optional caption.

This reuse of the established media procedure preserves permissions, object-key format, server-side validation, metadata records, and the no-binary-in-D1 rule. It is not a client bypass to a public bucket.

## 8. Media System

| Capability | Implementation |
| --- | --- |
| Storage provider abstraction | Local development can use an S3-compatible adapter; Cloudflare production uses the `CMS_MEDIA` R2 binding. |
| Storage key structure | `uploads/YYYY/MM/u{userId}/filename.ext`, with safe extension normalization and collision-resistant names in the Pages adapter. |
| Supported input | JPEG, PNG, WebP, AVIF, GIF, and PDF. |
| Upload limit | 10 MB per file, validated by browser and server. |
| Multi-file workflow | Drag/drop or file selection, per-file read/upload progress, success/failure status, and retry of failed source files. |
| Library metadata | Original filename, MIME type, byte count, uploader, storage provider/key/URL, alt text, title, caption, and description. |
| Replacement | Writes new object bytes but keeps the media record ID, preserving existing post/page references. |
| Search | Lists with bounded pagination and query filtering. |
| Deletion | Explicit metadata/reference deletion flow; authors/contributors are restricted to owned media. |
| Image derivatives | Deliberately not generated in the request path. The current free-tier-safe policy serves immutable originals and documents a future derivative pipeline boundary. |

## 9. Roles, Capabilities, and Ownership

The role names are exact: `admin`, `editor`, `author`, `contributor`, `subscriber`, and `viewer`. The UI may describe `admin` as **Administrator**, but the persisted/API role value remains `admin` for compatibility.

| Role | Content | Publishing | Media | Taxonomies | Tokens | Site settings/themes/plugins | Users |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `admin` | All content | Yes | All media | Yes | Yes | Yes | Yes |
| `editor` | Publication-wide editorial content | Yes | All media | Yes | Yes | No | No |
| `author` | Own content | Own posts/pages | Own media | No | Yes | No | No |
| `contributor` | Own drafts | No | Own media | No | No write-capable issuance | No | No |
| `subscriber` | Read permitted CMS data | No | No | No | No | No | No |
| `viewer` | Read permitted CMS data | No | No | No | No | No | No |

The permission map is centralized in `server/cms/permissions.ts`. Protected procedures invoke capability checks before repository mutations. Object-level checks then restrict author/contributor edits, trash, deletes, and media changes to records they own. Administrator user management additionally prevents self-demotion, removing a common CMS self-lockout failure mode.

## 10. WordPress-Compatible REST API

The API surface is documented in detail in [`wordpress-rest-api.md`](wordpress-rest-api.md).

| Resource path | Primary methods | Purpose |
| --- | --- | --- |
| `/api/wp/v2/posts` | `GET`, `POST` | List public posts or create a post. |
| `/api/wp/v2/posts/{id-or-slug}` | `GET`, `PATCH`, `DELETE` | Read, update, restore, trash, or permanently delete a post. |
| `/api/wp/v2/pages` | `GET`, `POST` | List public pages or create a page. |
| `/api/wp/v2/pages/{id-or-slug}` | `GET`, `PATCH`, `DELETE` | Read, update, restore, trash, or permanently delete a page. |
| `/api/wp/v2/media` | `GET`, `POST` | List/upload validated base64 media. |
| `/api/wp/v2/media/{id}` | `GET`, `PATCH` | Fetch/update/replace a stable media record. |
| `/api/wp/v2/categories`, `/tags` | `GET`; local adapter also offers controlled `POST` | Public taxonomy data and bounded local programmatic creation. |
| `/api/wp/v2/users` | `GET` | Privacy-safe public author identity data, never email or CMS role. |

REST authentication is JWT bearer-token based, not browser-session based. Tokens have explicit scopes such as `content:write`, `media:write`, and `taxonomy:write`; are hashed at rest; can expire; record last use; and can be revoked by deleting their active state. The Pages Function verifies both the HS256 signature and the D1-backed active token record, so a correctly signed but revoked token fails.

The API intentionally does not expose global settings, menu mutations, arbitrary CSS, theme administration, plugin activation, or role administration through general bearer tokens. Those operations have broad site-wide impact and remain protected dashboard procedures.

## 11. Public Fashion Editorial Theme

The bundled single theme is a reviewed Fashion Editorial runtime. It is intentionally a constrained theme boundary rather than an uncontrolled user-uploadable PHP/JavaScript theme marketplace.

| Route | Theme behavior |
| --- | --- |
| `/` | Hero plus latest cards and configured category sections; falls back to bundled editorial stories only when no published CMS posts exist. |
| `/blog` | Published post archive. |
| `/blog/:slug` | Article with SEO, theme metadata, reading time, hero treatment, headings, safe graphical HTML, and newsletter/footer. |
| `/page/:slug` | Published CMS page with parent breadcrumb and template resolution. |
| `/category/:slug` | Published posts with that category. |
| `/tag/:slug` | Published posts with that tag. |
| `/search?q=...` | Published content search and noindex metadata. |
| `/preview/:id` | Authenticated protected preview through the real theme, not an admin-only raw record dump. |

Theme controls include header menus, footer text/location/Instagram URL, homepage category slugs, controlled custom CSS, and a persisted theme record. The actual public shell reads the stored settings and menu values; browser coverage verifies a header menu update reaches the public header.

## 12. Theme and Plugin Extension Model

Themes and plugins use a deliberate **reviewed-code** extension model.

### Themes

The CMS currently ships one immutable bundled Fashion Editorial theme. Appearance records identify it and administrators can inspect its status, but untrusted uploaded themes are intentionally excluded. The runtime resolver maps the persisted supported theme key to the reviewed bundle. This keeps public rendering predictable and prevents arbitrary server/client code installation.

### Plugins

Plugins register hooks and editor blocks through a registry. The included Reading Time plugin demonstrates the lifecycle: activating it persists an administrator setting; a public hook adds reading-time data; an editor block can use its contribution; `unregisterPlugin()` removes owned hooks and blocks. Arbitrary plugin ZIP upload is intentionally not a feature.

## 13. SEO, Metadata, and Discoverability

| Feature | Implementation |
| --- | --- |
| Per-entry SEO fields | Title, description, focus keyword, canonical URL, robots index/follow, and Open Graph overrides are stored with content. |
| SEO analysis | Deterministic per-entry recommendations and a bounded aggregate dashboard summary. |
| Cached reporting | A 60-second in-memory aggregate cache keyed by request limit; invalidated after content lifecycle mutations. |
| Sitemap | Dynamic XML containing eligible published, non-trashed, indexable posts/pages. |
| Robots | Dynamic `robots.txt` from the CMS’s site indexing policy. |
| Initial crawler HTML | Local SSR renders public routes; Pages HTMLRewriter adds escaped D1-driven title, description, canonical, robots, OG, Twitter, article-date, and media tags. |
| Noindex boundaries | Administration, preview, and search get noindex delivery. Noindex entries are excluded from sitemap. |
| Social metadata safety | Metadata is escaped at the edge before insertion into HTML. |

## 14. Security Model

The complete control/test mapping appears in [`security-audit.md`](security-audit.md). The core controls are summarized here.

| Boundary | Control |
| --- | --- |
| Browser administration | Same-origin gate plus double-submit CSRF cookie/header validation for state-changing tRPC requests. |
| Programmatic API | JWT bearer token, scope check, D1 hash/revocation/expiry check, capability/ownership check. |
| Content HTML | Server allowlist sanitizer removes scripts, handlers, unsafe URLs, unknown active content, and non-approved frame sources. |
| Graphical embeds | HTTPS allowlist: YouTube, YouTube no-cookie, Vimeo, Spotify, Instagram. Sanitizer normalizes a permitted iframe to lazy loading, strict referrer policy, and an explicit sandbox. |
| Custom widgets | Only callout/note structured blocks; no arbitrary JavaScript, HTML snippets, or plugin payloads. |
| Media | Browser and server MIME/size validation, uploader ownership, R2 storage, metadata-only D1 rows. |
| Custom CSS | Maximum 12,000 characters and rejection of imports, URLs, executable constructs, JavaScript protocol, and HTML markup. |
| Privileged configuration | `site:manage` only for themes, plugins, settings, menus, CSS, and indexing policy. |
| REST abuse control | Development adapter rate limits 120 requests per source IP per minute and returns WordPress-shaped 429 errors. |

The visual/source HTML preview stays in a strict empty-sandbox iframe. The graphical preview renders generated block HTML, then the server independently sanitizes it before permanent persistence. Public routes only render `bodyHtml` after that server boundary.

## 15. Public Visibility, Cache, and Scale Logic

The CMS targets the stated scale of approximately **50,000 posts** and **500,000 media objects** through bounded access patterns rather than speculative distributed complexity.

| Concern | Design choice |
| --- | --- |
| Public content reads | Query only published and non-trashed records; page sizes cap at 100. |
| Taxonomy hydration | Batched relationship reads prevent N+1 category/tag queries across content pages. |
| Database indexes | Composite indexes support public listing, scheduler due-content lookup, sitemap generation, uploader media list, and reverse taxonomy lookup. |
| Sitemap | Excludes unpublishable state and noindex records; documents chunking/limits for expansion. |
| Media objects | Original file bytes live in R2; D1 list/search uses compact metadata. |
| Public cache correctness | Editorial reads are intentionally no-cache until a future explicit KV invalidation contract is implemented. This avoids stale publish/archive/trash state. |
| Mutable reporting cache | SEO aggregate cache is process-local, short TTL, and invalidated on mutations; it is never a public publication cache. |

## 16. Cloudflare-Native Implementation

| Artifact | Job |
| --- | --- |
| `wrangler.jsonc` | Pages D1/R2/KV bindings and public variables. |
| `functions/api/wp/v2/[[path]].ts` | Worker-runtime REST API with D1 token verification and R2 media writes. |
| `functions/media/[[key]].ts` | R2 object delivery. |
| `functions/sitemap.xml.ts` | D1-backed dynamic sitemap. |
| `functions/robots.txt.ts` | Dynamic robots policy. |
| `functions/[[path]].ts` | HTMLRewriter metadata injection and route-level noindex behavior. |
| `workers/scheduler.ts` | Cron-driven scheduled publication. |
| `migrations/*.sql` | D1 schema and performance-index evolution. |
| `wrangler.scheduler.jsonc` | Separate Worker D1 binding and five-minute cron trigger. |

Cloudflare Pages Functions can bind D1, R2, and KV resources in a Wrangler file or dashboard configuration. [1] The detailed D1 migration and binding setup is in [`cloudflare-d1-pages-deployment.md`](cloudflare-d1-pages-deployment.md).

## 17. Testing and Quality Gates

The project uses layered test evidence rather than relying on a single happy-path browser test.

| Test category | Coverage |
| --- | --- |
| Unit tests | Roles/capabilities, HTML sanitizer, custom CSS policy, media keys/types, graphical block serialization, SEO analysis/cache, plugin lifecycle, page/template rules. |
| Router tests | Auth and ownership boundaries, user management, lifecycle, settings, appearance, token management, custom content, taxonomies, media mutations. |
| Real-repository integration | REST draft→publish, scheduled exclusion, page lifecycle, archive/trash/restore, category/tag/search/sitemap visibility transitions. |
| Cloudflare contract tests | Pages REST response parity, edge metadata behavior, sitemap caching headers. |
| Public browser tests | Homepage shell and anonymous protected-preview boundary. |
| Authenticated browser tests | Visual/source editor safety, media queue/retry/metadata, dashboard publish/home/archive/search/trash flow, header-menu public-shell flow, and graphical blocks/safe embed preview. |

Run the complete quality gate:

```bash
pnpm check
pnpm test
pnpm build
pnpm test:e2e
pnpm test:e2e:editor
```

## 18. Important Operational Boundaries

1. **No arbitrary plugin or theme upload.** This is a security choice. Extend through reviewed code, the hook registry, and persisted activation records.
2. **No binary D1 storage.** Every media byte belongs in R2 or the compatible development object store.
3. **No executable custom widgets.** Graphical widgets are structured callout/note content; executable widgets require a new plugin threat model.
4. **No generic arbitrary iframe source.** Only listed HTTPS providers survive server sanitization and receive a normalized sandbox.
5. **No hidden public content.** Public readers, sitemap, and scheduler consistently exclude drafts, scheduled items, archived entries, and trashed records.
6. **No browser session as REST authentication.** REST requires issued bearer tokens; dashboard uses the browser-session boundary with CSRF protection.
7. **No implicit cross-environment database sharing.** Create and bind distinct preview resources when preview editorial data must be isolated.

## 19. Recommended Editorial Workflow

1. An administrator configures site settings, menus, categories, tags, theme settings, and approved plugin activation.
2. An author or contributor creates a draft using Markdown, visual HTML, or graphical blocks.
3. The editor uploads/selects media from the R2-backed library and adds accurate alternative text.
4. An editor reviews SEO fields, content status, and the protected theme preview.
5. The entry is published immediately or scheduled. The public theme, REST public reads, and sitemap include it only when eligible.
6. If correction/removal is needed, the entry is archived or trashed. Trash is reversible; force deletion requires an explicit action.
7. Programmatic systems use scoped bearer tokens and the documented WordPress-compatible REST endpoints.

## 20. Further Reading

| Document | Use it for |
| --- | --- |
| [`cloudflare-d1-pages-deployment.md`](cloudflare-d1-pages-deployment.md) | Step-by-step D1, R2, KV, secret, TOML, dashboard, and scheduler deployment. |
| [`wordpress-rest-api.md`](wordpress-rest-api.md) | Full REST resources, request bodies, scopes, lifecycle parameters, and error shapes. |
| [`user-roles.md`](user-roles.md) | Detailed role/capability matrix. |
| [`media-operations.md`](media-operations.md) | Media provider, retry, R2 delivery, and original-only derivative policy. |
| [`plugin-security.md`](plugin-security.md) | Plugin trust boundary and lifecycle. |
| [`content-safety.md`](content-safety.md) | HTML sanitization and source-mode safety policy. |
| [`scalability-review.md`](scalability-review.md) | Indexes, query plans, pagination, sitemap, and future upgrade thresholds. |
| [`security-audit.md`](security-audit.md) | Control-by-control implementation and regression evidence. |

## References

[1]: https://developers.cloudflare.com/pages/functions/bindings/ "Cloudflare Pages Functions — Bindings"
