# Atelier CMS Security Audit

**Audit date:** 15 August 2026  
**Scope:** The administration tRPC API, WordPress-compatible REST API, editorial content and media workflows, public delivery routes, configured plugin/theme extension points, and Cloudflare deployment adapters.

## Assessment

Atelier CMS enforces distinct security boundaries for browser-session administration and bearer-token programmatic publishing. The dashboard is protected by centralized role capabilities, object ownership rules, same-origin enforcement, and double-submit CSRF validation. The REST adapter accepts only verified JWT bearer tokens with explicit scopes and a persistent revocation check. Content, media, and controlled appearance configuration each have an independent validation path.

The system deliberately does **not** offer arbitrary theme upload, plugin upload, custom JavaScript, or custom head/body markup. That design choice keeps the extension surface inside a reviewed-code trust boundary rather than treating executable code as editorial content.

| Control area | Enforced behavior | Primary regression evidence |
| --- | --- | --- |
| Role capabilities | `admin`, `editor`, `author`, `contributor`, `subscriber`, and `viewer` are evaluated by a centralized capability map before protected procedures run. | [`server/cms/permissions.test.ts`](../server/cms/permissions.test.ts), [`server/routers/capabilityMatrix.test.ts`](../server/routers/capabilityMatrix.test.ts) |
| Exhaustive mutation boundary | The administrator path invokes every CMS mutation; subscriber and viewer are denied every mutation before repository writes. Non-administrators are denied all site-management actions. | [`server/routers/capabilityMatrix.test.ts`](../server/routers/capabilityMatrix.test.ts) |
| Object ownership | Author and contributor content and media mutation is ownership-aware; editors and administrators retain their documented editorial authority. | [`server/routers/contentLifecycle.test.ts`](../server/routers/contentLifecycle.test.ts), [`server/routers/capabilityMatrix.test.ts`](../server/routers/capabilityMatrix.test.ts) |
| Role administration | Only administrators can list users or change roles; an administrator cannot self-demote. | [`server/routers/users.test.ts`](../server/routers/users.test.ts) |
| Browser request origin | Cookie-authenticated write requests must present a same-origin `Origin` header before the route reaches a mutation handler. | [`server/_core/origin.test.ts`](../server/_core/origin.test.ts), [`server/_core/trpcGuard.test.ts`](../server/_core/trpcGuard.test.ts) |
| CSRF | State-changing dashboard requests require an exact double-submit cookie/header match; safe reads remain token-free. | [`server/_core/trpcGuard.test.ts`](../server/_core/trpcGuard.test.ts) |
| REST authentication | WordPress-style REST writes require an HS256 bearer token with the required scope; tokens are hash-persisted, revocable, and record use metadata. | [`server/cms/apiTokens.test.ts`](../server/cms/apiTokens.test.ts), [`server/cms/restAuth.test.ts`](../server/cms/restAuth.test.ts), [`server/cms/wpRest.test.ts`](../server/cms/wpRest.test.ts) |
| REST ownership and lifecycle | REST PATCH and DELETE apply the same ownership and lifecycle rules as the dashboard; default DELETE is soft trash, with explicit restore and force-delete paths. | [`server/cms/realPublication.integration.test.ts`](../server/cms/realPublication.integration.test.ts), [`server/cms/wpRest.test.ts`](../server/cms/wpRest.test.ts) |
| REST abuse limit | The local adapter limits REST traffic to 120 requests per IP per minute and returns WordPress-shaped `429 rest_rate_limited` responses with rate-limit headers. | [`server/cms/wpRest.test.ts`](../server/cms/wpRest.test.ts) |
| Rich HTML | Visual/source HTML is allowlist-sanitized on save; the source preview uses a fully sandboxed iframe. | [`server/cms/sanitize.test.ts`](../server/cms/sanitize.test.ts), [`e2e/editor-modes.spec.ts`](../e2e/editor-modes.spec.ts) |
| Media type and size | Both client and server validate JPEG, PNG, WebP, AVIF, GIF, and PDF uploads at 10 MB or below. Media bytes are held in object storage, never the database. | [`client/src/lib/mediaValidation.test.ts`](../client/src/lib/mediaValidation.test.ts), [`server/cms/media.test.ts`](../server/cms/media.test.ts), [`e2e/media-upload.spec.ts`](../e2e/media-upload.spec.ts) |
| Media isolation | Replace, metadata update, and delete operations require uploader ownership for author/contributor roles; failed files can be retried without affecting neighboring uploads. | [`server/routers/capabilityMatrix.test.ts`](../server/routers/capabilityMatrix.test.ts), [`e2e/media-upload.spec.ts`](../e2e/media-upload.spec.ts) |
| Controlled custom CSS | The administrative CSS field is bounded to 12,000 characters and rejects remote imports, URLs, executable constructs, markup, and JavaScript URLs. | [`server/cms/customCss.test.ts`](../server/cms/customCss.test.ts), [`server/routers/settings.test.ts`](../server/routers/settings.test.ts) |
| Plugin and theme trust | The public theme is a reviewed bundled single-theme runtime. Plugin activation uses an administrator-only persisted allowlist; there is no runtime executable-code upload path. | [`server/cms/extensions.test.ts`](../server/cms/extensions.test.ts), [`server/routers/appearance.test.ts`](../server/routers/appearance.test.ts), [`docs/plugin-security.md`](plugin-security.md) |
| Public visibility | Public queries, sitemap generation, and scheduled publishing exclude drafts, scheduled, archived, and trashed entries where appropriate. | [`server/cms/publicationVisibility.integration.test.ts`](../server/cms/publicationVisibility.integration.test.ts), [`server/cms/realPublication.integration.test.ts`](../server/cms/realPublication.integration.test.ts), [`server/cms/scheduler.test.ts`](../server/cms/scheduler.test.ts) |
| Crawler metadata | Edge HTML rewriting escapes metadata values and applies noindex to administration, preview, and search routes. | [`server/cms/edgeMetadata.test.ts`](../server/cms/edgeMetadata.test.ts), [`docs/edge-metadata-rendering.md`](edge-metadata-rendering.md) |

## Operational Boundaries

The local REST limiter is a development-adapter protection. Cloudflare Pages production traffic should rely on Cloudflare's edge controls and configured worker limits rather than assuming a single-process memory limiter coordinates across isolates. The existing R2 strategy serves immutable original objects; derivative generation remains deliberately outside the request path.

The E2E session fixture used by browser tests is denied outside development and requires both `CMS_E2E_TEST_AUTH=1` and the dedicated request header. It is not a production login bypass. The corresponding runtime guard is covered by [`server/_core/context.test.ts`](../server/_core/context.test.ts).

## Conclusion

The completed controls establish a least-privilege editorial CMS boundary appropriate for the declared Cloudflare-first architecture. Future changes that introduce third-party executable plugins, arbitrary markup/JavaScript, cross-origin dashboard writes, direct-to-R2 multipart uploads, or a distributed application cache require a new threat-model review and targeted regression coverage before release.
