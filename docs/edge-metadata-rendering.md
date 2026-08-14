# Cloudflare Pages Metadata Rendering

Cloudflare Pages serves the public application shell as static HTML. The catch-all Pages Function at `functions/[[path]].ts` uses the Worker `HTMLRewriter` API to append server-derived head metadata before that HTML reaches crawlers or social preview clients. The public site therefore has an edge-compatible metadata path without attempting to execute the React SSR bundle inside a Worker.

| Route class | Edge data source | Initial HTML metadata |
| --- | --- | --- |
| `/blog/:slug` | Published, non-trashed post in D1 | Escaped title, description, canonical URL, Open Graph article fields, published/modified times. |
| `/page/:slug` | Published, non-trashed page in D1 | Escaped title, description, canonical URL, and website Open Graph metadata. |
| `/category/:slug`, `/tag/:slug` | Taxonomy record in D1 | Taxonomy SEO title/description when configured, otherwise site defaults. |
| `/`, `/blog` | Public site settings in D1 | Site title and description, with a stories archive title for `/blog`. |
| `/admin/*`, `/preview/*`, `/search*` | Site defaults only | `noindex, follow` to prevent administrative, preview, and query-result shells from being indexed. |

`CMS_ORIGIN` must be the deployed canonical origin, for example `https://journal.example.com`. The function uses it to emit absolute canonical and `og:url` values. It follows existing dynamic API and media routes by specificity, so those specialized Pages Functions remain responsible for their own responses.

If D1 metadata reads temporarily fail, the rewriter falls back to an escaped site-default head and leaves the public static page available. This protects availability while avoiding a database failure becoming an edge-rendering outage. The function has regression coverage for article metadata resolution, escaping, administrative noindex behavior, and the raw HTML rewrite path.
