# WordPress-Compatible REST API

The Cloudflare Pages adapter exposes WordPress-style paths below `/api/wp/v2`. Collection responses use JSON and support the documented pagination conventions for content and media.

| Endpoint | Methods | Purpose |
| --- | --- | --- |
| `/api/wp/v2/posts` | `GET`, `POST` | List published posts or create a post with a JWT that has `content:write`. |
| `/api/wp/v2/posts/{id-or-slug}` | `GET` | Fetch one published post. |
| `/api/wp/v2/pages` | `GET`, `POST` | List published pages or create a page with a JWT that has `content:write`. |
| `/api/wp/v2/pages/{id-or-slug}` | `GET` | Fetch one published page. |
| `/api/wp/v2/media` | `GET`, `POST` | List media or upload base64-encoded media with `media:write`. |
| `/api/wp/v2/media/{id}` | `GET`, `PATCH` | Fetch a media object or replace its file with `media:write` while preserving its ID. |
| `/api/wp/v2/categories` and `/tags` | `GET` | List taxonomy terms. |
| `/api/wp/v2/categories/{id}` and `/tags/{id}` | `GET` | Fetch one taxonomy term. |
| `/api/wp/v2/users` and `/users/{id}` | `GET` | Fetch public author identity fields only. |

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

`PATCH` and `DELETE /api/wp/v2/posts/{id}` and `/pages/{id}` require a JWT with the `content:write` scope. Authors and contributors may mutate or delete only their own entries; editors and administrators retain publication-wide editorial authority. Deletion is currently an explicit permanent-delete contract rather than WordPress trash-state emulation. A successful response returns `{ "deleted": true, "previous": { ... } }`, while a missing entry returns `rest_post_invalid_id` and a cross-owner mutation returns `cms_forbidden`.
