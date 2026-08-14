# Publication Freshness and Cache Strategy

Atelier CMS deliberately separates **mutable editorial data** from **immutable media delivery**. This avoids serving stale homepage, archive, category, tag, search, article, page, or preview results after a publication-state change while staying within Cloudflare free-plan constraints.

| Surface | Delivery behavior | Publication-change effect |
| --- | --- | --- |
| Public SSR pages in the local production adapter | `Cache-Control: no-cache` | The browser and any intermediary must revalidate before reuse, so a draft, publish, archive, trash, restore, or permanent-delete transition is visible on the next request. |
| Public tRPC content queries | Database-backed, with no application-level response cache | Homepage, archive, taxonomy, search, and page data are read from the current published, non-trashed repository state. |
| `sitemap.xml` and `robots.txt` | `public, max-age=300` | Crawler artifacts may remain cached for up to five minutes; sitemap queries include only published, non-trashed, indexable entries. |
| R2 media objects | `public, max-age=31536000, immutable` | Object keys are unique year/month/uploader-scoped keys. A replacement receives a new object key, so immutable caching cannot serve prior file bytes at the new URL. |

## Invalidation Decision

The current architecture does **not** put mutable public content into KV. The absence is intentional: a cache without tag or purge coordination would create stale publication surfaces. Publication and trash operations update D1; the public repository filters `published` and `trashed_at IS NULL` on each read. The scheduler uses the same condition, preventing a trashed scheduled entry from being promoted.

> **Operational consequence:** The public editorial shell is immediately consistent on the next HTML or tRPC request. Search crawlers can observe sitemap and robots changes within the documented five-minute cache window.

If a future deployment adds KV or the Cloudflare Cache API for high-traffic archives, every lifecycle mutation must purge or version the affected homepage, post archive, category, tag, search, individual-content, and sitemap keys. Do not add a mutable public-response cache without that invalidation contract.
