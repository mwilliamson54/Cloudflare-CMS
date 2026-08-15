# WordPress-Compatible REST API

Atelier CMS exposes a WordPress-shaped publishing API below `/api/wp/v2`. The local Express adapter and the Cloudflare Pages Function share the required post, page, media, taxonomy, and author-identity paths. The implementation deliberately preserves the WordPress response conventions most useful to programmatic publishers while retaining CMS-specific controls for roles, trash, and trusted site configuration.

## Resource Matrix

| Endpoint | Supported methods | Authentication and purpose |
| --- | --- | --- |
| `/api/wp/v2/posts` | `GET`, `POST` | Lists published, non-trashed posts; creates a post with `content:write`. |
| `/api/wp/v2/posts/{id-or-slug}` | `GET`, `PATCH`, `DELETE` | Public published read by ID or slug; authenticated update, restore, soft trash, or permanent deletion. |
| `/api/wp/v2/pages` | `GET`, `POST` | Lists published, non-trashed pages; creates a page with `content:write`. |
| `/api/wp/v2/pages/{id-or-slug}` | `GET`, `PATCH`, `DELETE` | Public published read by ID or slug; authenticated update, restore, soft trash, or permanent deletion. |
| `/api/wp/v2/media` | `GET`, `POST` | Lists media; uploads a base64-encoded object with `media:write`. |
| `/api/wp/v2/media/{id}` | `GET`, `PATCH` | Retrieves metadata or replaces bytes while preserving the stable media ID. |
| `/api/wp/v2/categories` and `/api/wp/v2/tags` | `GET` | Lists public taxonomy terms. The local adapter also accepts `POST` with `taxonomy:write`; site-wide taxonomy administration remains a dashboard capability for Pages deployments. |
| `/api/wp/v2/categories/{id}` and `/api/wp/v2/tags/{id}` | `GET` | Retrieves one public taxonomy term. |
| `/api/wp/v2/users` and `/api/wp/v2/users/{id}` | `GET` | Returns privacy-safe author identity fields only. Email and CMS role are never exposed. |

## Authentication, Roles, and Scopes

Create a token in **CMS → API tokens**. A raw token is shown once, while the database stores only its hash, persistent token ID, scopes, expiry, revocation timestamp, and last-use timestamp. Send it as a bearer token.

```bash
curl -X POST "$CMS_ORIGIN/api/wp/v2/posts" \
  -H "Authorization: Bearer $CMS_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{
    "title": "A considered silhouette",
    "slug": "considered-silhouette",
    "status": "draft",
    "content": { "raw": "# Notes\n\nDraft body." },
    "meta": { "seo_title": "A considered silhouette" }
  }'
```

`content:write` is required for post and page mutation; `media:write` is required for media upload/replacement; and `taxonomy:write` is required for local taxonomy creation. Administrators, editors, and authors may publish or schedule their own permitted content. Contributors may create and revise only their own drafts. Subscribers and viewers cannot create write-capable CMS tokens or use write endpoints. Author and contributor REST mutations are ownership-checked.

## Request Shapes

Post and page creation accepts `title`, `slug`, `status`, `date`, `excerpt`, `content`, `featured_media`, `categories`, `tags`, and selected SEO properties under `meta`: `seo_title`, `seo_description`, `canonical_url`, `robots_index`, and `robots_follow`. A WordPress-style scalar or `{ "raw": "…" }` object is accepted for `title`, `excerpt`, and `content`.

Media upload requires `fileName`, `mimeType`, and `dataBase64`, with optional `alt_text` and `title`. Supported MIME types are JPEG, PNG, WebP, AVIF, GIF, and PDF. A file must be at least one byte and no more than 10 MB. Cloudflare production writes bytes to `CMS_MEDIA` R2 under a year/month/uploader key; D1 stores only the metadata and object reference.

```json
{
  "fileName": "lookbook-cover.webp",
  "mimeType": "image/webp",
  "dataBase64": "UklGRi4AAABXRUJQVlA4...",
  "alt_text": "Tailored yellow set on a basketball court",
  "title": "Lookbook cover"
}
```

`PATCH /api/wp/v2/media/{id}` uses the same required file fields and writes a new object key while preserving the media record ID used by content references. The public media delivery route is `/media/{key}`.

## Pagination, Search, and Visibility

`posts`, `pages`, `media`, and `users` accept `page` and `per_page`; `per_page` is bounded to 100. Their collection responses provide `X-WP-Total` and `X-WP-TotalPages`. Post and page collections accept `search` and match title, excerpt, and body before calculating totals.

Public post and page reads return only published, non-trashed content. A draft, scheduled, archived, trashed, or absent individual resource returns `404 rest_post_invalid_id` without disclosing editorial metadata. Sitemap generation applies the same published/non-trashed rule and additionally excludes entries marked `noindex`.

## Trash, Restore, and Permanent Deletion

The default `DELETE /api/wp/v2/posts/{id}` or `/pages/{id}` is a soft-trash action. It writes a separate `trashed_at` timestamp while preserving the required lifecycle status (`draft`, `scheduled`, `published`, or `archived`). The resulting entry is excluded from public reads, archives, sitemap output, and scheduled promotion.

Use `PATCH /api/wp/v2/posts/{id}?restore=true` or the equivalent page path to remove the trash timestamp. Use `DELETE /api/wp/v2/posts/{id}?force=true` only after review to permanently remove the record and its taxonomy relations. A forced deletion retains any child page by making it top-level. Repeating an invalid trash/restore transition returns `409 rest_invalid_status`.

## Errors and Intentional Boundaries

Errors use the WordPress-compatible shape below. Invalid or missing bearer tokens return `401`; scope, role, and ownership denials return `403`; the local development adapter returns `429 rest_rate_limited` after 120 requests per source IP in 60 seconds.

```json
{
  "code": "rest_post_invalid_id",
  "message": "Invalid post ID.",
  "data": { "status": 404 }
}
```

Global settings, header/footer menus, controlled custom CSS, theme inspection, plugin activation, and user-role administration are intentionally **not** bearer-token REST resources. They remain administrator-only dashboard procedures because they alter site-wide behavior or the executable-code trust boundary.

## Contract Evidence

The local HTTP adapter is covered by [`server/cms/wpRest.test.ts`](../server/cms/wpRest.test.ts) and the real-repository lifecycle tests in [`server/cms/realPublication.integration.test.ts`](../server/cms/realPublication.integration.test.ts). Cloudflare Pages resource and user response parity are covered by [`server/cms/cloudflareUsers.test.ts`](../server/cms/cloudflareUsers.test.ts), while the Pages Function remains in [`functions/api/wp/v2/[[path]].ts`](../functions/api/wp/v2/[[path]].ts).
