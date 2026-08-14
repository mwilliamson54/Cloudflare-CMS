# Environment and binding contract

| Name | Runtime | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Development adapter | MySQL-compatible development database connection. |
| `JWT_SECRET` | Development adapter | JWT signing key, at least 32 characters. |
| `CANONICAL_ORIGIN` | Development adapter | Absolute public origin for canonical and sitemap URLs. |
| `CMS_DB` | Cloudflare binding | D1 database binding. |
| `CMS_MEDIA` | Cloudflare binding | R2 bucket binding. |
| `CMS_CACHE` | Cloudflare binding | Optional KV binding for cache and throttling policies. |
| `CMS_JWT_SECRET` | Cloudflare secret | JWT signing key; configure it as a secret. |
| `CMS_ORIGIN` | Cloudflare variable | Absolute production URL used by the sitemap and robots output. |

Do not place secret values in client-side environment variables or commit them to source control.
