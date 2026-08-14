# WordPress-Compatible REST API

The Cloudflare Pages adapter exposes WordPress-style paths below `/api/wp/v2`. Collection responses use JSON and support the documented pagination conventions for content and media.

| Endpoint | Methods | Purpose |
| --- | --- | --- |
| `/api/wp/v2/posts` | `GET`, `POST` | List published posts or create a post with a JWT that has `content:write`. |
| `/api/wp/v2/posts/{id-or-slug}` | `GET`, `PATCH`, `DELETE` | Fetch a published post; update, restore, trash, or force-delete with a content-writing JWT. |
| `/api/wp/v2/pages` | `GET`, `POST` | List published pages or create a page with a JWT that has `content:write`. |
| `/api/wp/v2/pages/{id-or-slug}` | `GET`, `PATCH`, `DELETE` | Fetch a published page; update, restore, trash, or force-delete with a content-writing JWT. |
| `/api/wp/v2/media` | `GET`, `POST` | List media or upload base64-encoded media with `media:write`. |
| `/api/wp/v2/media/{id}` | `GET`, `PATCH` | Fetch a media object or replace its file with `media:write` while preserving its ID. |
| `/api/wp/v2/categories` and `/tags` | `GET` | List taxonomy terms. |
| `/api/wp/v2/categories/{id}` and `/tags/{id}` | `GET` | Fetch one taxonomy term. |
| `/api/wp/v2/users` and `/users/{id}` | `GET` | Fetch paginated public author identity fields only; email and role data are never returned. |

## Authentication

Create a JWT in **CMS → API tokens**. Tokens are shown once, stored as hashes, have explicit scopes, include the issuing role, and can be revoked. Send the token in an `Authorization: Bearer <token>` header.

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

`admin`, `editor`, and `author` may publish or schedule through a valid content-writing token. Contributors may create drafts but cannot publish or schedule. Subscriber and Viewer roles cannot issue or use write-capable CMS tokens.

## Media Uploads

`POST /api/wp/v2/media` accepts `fileName`, `mimeType`, `dataBase64`, optional `alt_text`, and optional `title`. The deployed adapter writes directly to the `CMS_MEDIA` R2 binding with a `uploads/YYYY/MM/u{userId}/` key. Supported types are JPEG, PNG, WebP, AVIF, GIF, and PDF. Each object is limited to 10 MB.

> The public media route is `/media/{key}`. Metadata is persisted in D1; media bytes remain in R2.

## Collections and Pagination

The `posts`, `pages`, `media`, and `users` collections accept `page` and `per_page` parameters; `per_page` is capped at 100. Their responses include `X-WP-Total` and `X-WP-TotalPages` headers. Production post and page collections also accept `search`, which filters title, excerpt, and body content before calculating both the rows and pagination totals.

## Intentional Compatibility Boundaries

The adapter implements the public content, taxonomy, media, and author-identity resources that programmatic publishing clients require. Menu configuration and global site settings are **not** exposed as WordPress REST write resources. They remain protected CMS administration procedures because they control site-wide behavior, custom CSS, trusted plugin activation, and indexing policy; exposing them through general bearer-token scopes would weaken the privilege boundary. Public menu and public setting values continue to be served through the CMS public site contract.

The public `/users` collection and individual identity responses are contract-tested in both the local adapter and the Cloudflare Pages Function. Both return the same privacy-safe identity fields, pagination headers, and stable author URL shape.

## Media Replacement

`PATCH /api/wp/v2/media/{id}` accepts the same validated file fields as upload: `fileName`, `mimeType`, and `dataBase64`. The CMS writes the replacement to a new R2 object and updates the existing metadata record rather than creating a new media ID. Existing post and page references therefore remain valid.

## Errors, Visibility, and Deletion

Public post and page collections contain only `published` content. Requests for a draft, scheduled, archived, or missing individual entry return HTTP `404` with the WordPress-style body below rather than disclosing the entry’s status or metadata.

```json
{
  "code": "rest_post_invalid_id",
  "message": "Invalid post ID.",
  "data": { "status": 404 }
}
```

Authentication and capability failures use the same stable shape: `{ "code", "message", "data": { "status" } }`. A missing or invalid bearer token yields `401`; a valid token without the required scope or publication capability yields `403`; development rate limiting returns `429` with `rest_rate_limited`. Unknown methods or resources return `404` with `rest_no_route`.

`PATCH` and `DELETE /api/wp/v2/posts/{id}` and `/pages/{id}` require a JWT with the `content:write` scope. Authors and contributors may mutate only their own entries; editors and administrators retain publication-wide editorial authority. The default `DELETE` is non-destructive: it sets a separate `trashed_at` timestamp while preserving the original required status (`draft`, `scheduled`, `published`, or `archived`). Trashed entries are excluded from public reads, archives, sitemap delivery, and scheduled-publication promotion.

Use `PATCH ?restore=true` to restore a trashed entry to its preserved status. Use `DELETE ?force=true` only after review to permanently remove the content and its taxonomy relations; child pages are retained as top-level entries. Default trash responses contain `{ "deleted": false, "trashed": true, "previous": { ... }, "content": { ... } }`, while force deletion returns `{ "deleted": true, "previous": { ... } }`. Missing entries return `rest_post_invalid_id`, a cross-owner mutation returns `cms_forbidden`, and invalid trash transitions return `rest_invalid_status` with HTTP `409`.
