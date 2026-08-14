# Page and Post Delivery Matrix

Pages and posts share the core CMS lifecycle, SEO, media, and template contracts, but they deliberately do not share the same public aggregation behavior. This keeps hierarchical evergreen pages isolated from the journal archive model.

| Capability | Posts | Pages |
| --- | --- | --- |
| Public route | `/blog/:slug` | `/page/:slug` |
| Collection | Blog archive and search | Page list only; no public page archive module is rendered |
| Taxonomies | Category and tag archives | Not used as public page discovery surfaces |
| Author / related content | Reserved for editorial-post presentation | Not fetched or rendered |
| Hierarchy | Flat editorial permalink | Optional parent page lookup and breadcrumb |
| Templates | Editorial template selection | Same safe template registry, resolved independently through the page route |
| Public query | Published post content type only | Published page content type only |

The `site.page` public procedure retrieves the requested page through the published-only page lookup and, when present, makes a direct parent-page lookup. It does not issue post archive queries. Public category and tag procedures independently request only published posts. Regression tests assert these repository contracts so post archive behavior cannot be accidentally coupled into page rendering.
