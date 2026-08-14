# Scalability Review: 50,000 Posts and 500,000 Media Objects

This review covers the CMS repository and Cloudflare D1 baseline for the intended editorial scale. It focuses on bounded result sets, index alignment, taxonomy hydration, scheduler promotion, and crawler delivery rather than artificial data generation.

| Workload | Applied safeguard | Evidence and remaining boundary |
| --- | --- | --- |
| Public post, page, and custom-type archives | Composite `content_type_id, status, trashed_at, published_at, updated_at` index; repository `perPage` is clamped to 100 | A live development planner check used `content_entries_public_listing_index` with an ordered index range scan and embedded limit. Offset pagination remains suitable for normal editorial navigation; cursor pagination is the next upgrade if deep page numbers become a product requirement. |
| Scheduled publication | Composite `status, trashed_at, scheduled_at` index | The scheduler’s due-entry query uses `content_entries_schedule_guard_index`, including the non-trashed guard. |
| Sitemap generation | Composite `status, trashed_at, robots_index, updated_at` index and explicit 49,999 entry cap | The current single sitemap is bounded below the sitemap URL limit. Add a sitemap index and chunked child sitemaps before surpassing that bound. |
| Media library and ownership views | `created_at` plus `uploaded_by_id, created_at` indexes; pages capped at 100 | The planner uses `media_uploader_created_index` for uploader-scoped ordered media reads. R2 retains binary bytes, keeping D1 metadata-only. |
| Taxonomy hydration and deletion | Batched relation hydration and reverse `category_id, content_entry_id` / `tag_id, content_entry_id` indexes | A paginated content page requires one base query plus two batched relation queries, not one query per entry. Reverse indexes protect taxonomy cleanup and future archive lookups. |

## Query-Plan Verification

The development database was inspected after applying the generated non-destructive migration. The planner selected `content_entries_public_listing_index` for a published, non-trashed post listing with ordered limit; `content_entries_schedule_guard_index` for due scheduled entries; and `media_uploader_created_index` for ordered uploader media lookup. This confirms that the new index column order matches the repository predicates and sort keys.

## Operational Limits and Next Upgrades

The current design is appropriate for the stated target when editorial users navigate ordinary page depths and public search traffic is moderate. Title and excerpt search intentionally uses substring matching, which is not a general full-text index. If search becomes a primary discovery surface at scale, introduce a Cloudflare-native search index or a dedicated full-text service rather than expanding unbounded SQL `LIKE` scans.

Similarly, do not introduce an application cache for mutable archive results until a purge or versioning contract covers every affected home, archive, taxonomy, search, individual-content, and sitemap key. The documented no-cache public-response policy avoids stale publication state today.
