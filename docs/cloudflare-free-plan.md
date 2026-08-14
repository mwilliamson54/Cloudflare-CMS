# Cloudflare Free-Plan Operational Review

At the time of this review, the CMS architecture fits Cloudflare’s free-plan operating model when it remains a lightweight editorial platform: static public assets are served by Pages, request-time logic runs in Pages Functions/Workers, structured data stays in D1, and media bytes remain in R2.

| Platform area | Current free-plan constraint | CMS design response |
| --- | --- | --- |
| Worker requests | 100,000 requests per day; 10 ms CPU per request; 128 MB memory; 50 subrequests per invocation. [1] | Keep Functions thin, avoid SSR-wide database fanout, and cap CMS REST lists at 100 entries. |
| Pages Functions | Function requests count toward the Workers quota. [4] | Public theme behavior is primarily static/client-side; public Functions are limited to API, sitemap, robots, and media delivery. |
| D1 | Free accounts have 10 databases, 500 MB per database, 5 GB total storage, and 50 queries per Worker invocation. [2] | Store metadata only; use indexed primary queries, bounded pagination, and no per-card N+1 requests. |
| R2 | Free usage includes 10 GB-month storage, 1 million Class A operations, and 10 million Class B operations per month. [3] | Store originals in year/month keys, cache immutable public media, and avoid generating thumbnails synchronously on reads. |
| Pages deploys | The Free plan allows 500 builds per month, one concurrent build, 20,000 static files per site, and 25 MiB maximum asset size. [4] | Keep generated media out of the deployment bundle and deliver it from R2. |

## Operational Rules

The free plan is suitable for an editorial site with bounded API operations and cached public delivery. It is not suitable for CPU-heavy image processing, synchronous bulk SEO scans, broad unpaginated media inventories, or long-running background work. Scheduled publishing must process records in small, idempotent batches. Image transformations should be generated before upload or delegated to an external image pipeline; the free Worker CPU allowance is too small for server-side image processing.

The current CMS follows these rules by storing only media metadata in D1, serving public media from R2, constraining REST pagination, caching media immutably, and using short scheduled work. As content approaches the D1 storage limit or the Worker daily request limit, the operator should monitor Cloudflare usage and consider a paid plan, a read replica strategy, or a data-archiving policy.

## Explicit Non-Goals on the Free Plan

The CMS does not promise real-time collaboration, full-text search over hundreds of thousands of large documents, on-demand image resizing, or a universal plugin marketplace. Those capabilities require more persistent compute, additional paid Cloudflare products, or a separate service.

## References

[1]: https://developers.cloudflare.com/workers/platform/limits/ "Cloudflare Workers Limits"
[2]: https://developers.cloudflare.com/d1/platform/limits/ "Cloudflare D1 Limits"
[3]: https://developers.cloudflare.com/r2/pricing/ "Cloudflare R2 Pricing and Free Tier"
[4]: https://developers.cloudflare.com/pages/platform/limits/ "Cloudflare Pages Limits"
