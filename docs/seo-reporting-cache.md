# SEO Reporting Cache Model

The administrator aggregate SEO report analyzes a bounded sample of up to 100 posts. Its deterministic recommendations are cached **per requested sample limit** for 60 seconds in the running CMS instance. This prevents repeated dashboard refreshes from re-reading and re-analyzing the same entries while keeping the reporting window short and predictable.

| Event | Cache behavior |
| --- | --- |
| Repeated aggregate report request with the same limit inside 60 seconds | Returns the cached summary without another repository list query. |
| TTL expiration | Recomputes the bounded summary on the next request and starts a new 60-second window. |
| CMS content create, update, trash, restore, or permanent delete | Clears all aggregate SEO cache entries immediately after the successful write. |
| Scheduler publication or instance restart | A warm instance may hold a result for at most the remaining 60-second TTL; a new instance begins with no cached data and recomputes safely. |

The cache stores only aggregate result objects, not entry bodies. It is intentionally in-memory because the report is administrator-only, bounded, and advisory. A shared KV or materialized reporting table is unnecessary at the present scale; if cross-instance real-time reporting becomes a requirement, replace this module with a versioned shared cache and increment its version from every content lifecycle mutation and scheduled promotion.
