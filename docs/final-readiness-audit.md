# Atelier CMS Final Readiness Audit

**Audit date:** 14 August 2026  
**Scope:** The existing Atelier CMS codebase, its public fashion theme, administration surface, local Express adapter, Cloudflare Pages Functions artifacts, automated tests, and tracked production gaps.

## Executive Assessment

Atelier CMS is a substantial, working CMS foundation rather than a static site with a superficial administration layer. It contains persisted content types, WordPress-style roles, workflow statuses, media metadata, taxonomy relations, menus, site settings, API tokens, themes, plugins, and WordPress-compatible REST routes. The editorial dashboard controls the public fashion theme through real tRPC procedures and database-backed settings. The current verified suite contains **73 automated tests across 24 test files**, and the Node production build completes successfully.

The system is suitable for continued staged implementation and local production-adapter deployment. It is **not yet a release-complete Cloudflare Pages CMS** because several cross-cutting requirements remain partial: Cloudflare’s Pages/Workers adapter does not execute the new Node server-rendering bundle; full D1/Pages integration scenarios have not replaced local adapter tests; a trusted custom-code model does not exist; and image derivatives, recoverable trash, custom-content administration, and full visual-editor browser coverage remain incomplete. These are explicit engineering boundaries, not hidden assumptions.

| Readiness area | Evidence | Assessment |
| --- | --- | --- |
| CMS domain model | Persisted users, roles, content types, entries, taxonomies, media, tokens, menus, settings, themes, and plugins. | **Implemented.** |
| Editorial workflow | Draft, scheduled, published, and archived states; protected previews; idempotent scheduled promotion; ownership checks. | **Implemented with integration gaps.** |
| Administration | Real content, taxonomy, media, token, menu, SEO-summary, appearance, and user-management procedures and panels. | **Implemented with remaining custom-content and custom-code gaps.** |
| REST API | JWT-authenticated WordPress-compatible post, page, media, category, tag, and user surfaces with pagination, ownership-aware PATCH, and permanent DELETE. | **Implemented locally; Pages parity remains to be verified.** |
| Public fashion theme | Homepage, archives, search, taxonomy routes, articles, public pages, protected previews, menus, and persisted single-theme fallback. | **Implemented.** |
| SEO delivery | Sitemap, robots, canonical/robots/OG fields, JSON-LD client behavior, aggregate SEO analysis, and local SSR response rendering. | **Implemented locally; edge delivery remains open.** |
| Cloudflare target | D1/R2/KV bindings, Pages REST/media/sitemap/robots Functions, D1 migration, scheduled Worker, deployment documentation. | **Implemented baseline with a critical SSR-adapter boundary.** |
| Security | Capability matrix, ownership checks, token hashing/revocation/scopes, sanitization, sandboxed source preview, origin guard, and double-submit CSRF writes. | **Implemented baseline with a final audit and trust-model work remaining.** |

## Verified Functional Surface

The editorial model provides WordPress-style access levels: `admin` represents Administrator, alongside `editor`, `author`, `contributor`, `subscriber`, and `viewer`. Capability checks control publication, user management, menus, site settings, plugins, media, and API token management. Author and contributor mutations are ownership-aware; editors retain cross-author editing rights where their capabilities permit it. The test suite exercises role changes, self-demotion safeguards, viewer mutation denial, ownership enforcement, REST token revocation, and same-origin CSRF rejection.

Content supports posts, pages, custom types, parent-page references, five presentation templates, dynamic fields, Markdown, visual HTML, and source HTML. The source pipeline sanitizes allowed HTML server-side and previews source content in a sandboxed iframe. Scheduled content is held outside public queries until the scheduled Worker promotes it, and archived content is likewise excluded. Public site and REST regressions now cover the scheduled and archived non-public contract.

Media is metadata-first. File bytes are placed in an S3-compatible provider locally and R2 in the Pages adapter; database rows retain the key, URL, MIME type, dimensions, captioning fields, and uploader metadata. The administration UI supports multiple-file selection/drop, search, metadata changes, stable-ID replacement, and reference deletion. The documented initial R2 strategy intentionally delivers originals with immutable cache headers; a derivative thumbnail pipeline is deferred.

## Public Delivery and Search Surface

The bundled Fashion Editorial theme has a safe single-theme runtime boundary. Header, footer, newsletter, homepage, archive, article, preview, and public-page consumers resolve the persisted `theme` setting through that boundary and fall back to the reviewed bundled theme for missing, unsupported, or malformed values. A rendered public-shell regression test covers header, newsletter, and footer output across those metadata states.

The local Express production adapter now server-renders public routes. It prefetches only an explicit allowlist of viewer-independent site procedures, dehydrates the exact tRPC query keys consumed by client components, embeds the state safely, and injects escaped title, description, canonical, Open Graph, Twitter, article-time, and robots metadata. Public misses return `404` with noindex; administration and protected-preview routes render noindex shells without prefetching private data. Raw production HTTP checks confirmed populated body markup, canonical and OG tags, dehydrated state, and the expected `404`/`200 + noindex` distinctions.

> The Node SSR bundle is a **local adapter capability**, not a Cloudflare Pages deployment capability. Pages Functions currently expose the REST, media, sitemap, and robots paths; a Workers-compatible renderer or edge HTML-rewrite design is still required for crawler-visible initial metadata on the Cloudflare deployment.

## Production Gaps Requiring Deliberate Follow-Through

| Priority | Remaining requirement | Why it matters | Recommended completion evidence |
| --- | --- | --- |
| High | Pages/Workers-compatible SSR or edge metadata delivery | The intended Cloudflare deployment cannot rely on the local Node SSR process. | Cloudflare-compatible render/rewrite code plus deployed raw-HTML checks. |
| High | Full D1/Pages integration suite | Router and local HTTP tests do not prove all production bindings and D1 SQL behavior. | Ephemeral D1 fixture tests for publication, sitemap, noindex, media, and REST write flows. |
| High | End-to-end API and workflow coverage | Custom entries, scheduled/archived transitions, and content deletion need database-backed scenarios. | Browser/API integration tests against a seeded adapter. |
| High | Custom-code trust model | Arbitrary HTML/JS injection changes the XSS, CSP, and plugin trust boundary. | Approved scope, CSP, role controls, sanitization/validation, and security tests. |
| Medium | Recoverable trash | Current permanent deletion is documented, but editorial recovery is absent. | Trash status/schema, restore UI, ownership coverage, and retention policy. |
| Medium | Custom-content administration completion | The persistence model exists, but custom-type user journeys need full UI and test coverage. | Author/editor CRUD flows, field rendering, permissions, and public delivery tests. |
| Medium | Media derivatives | Original-only delivery is operationally simple but not optimal at a large image library. | Controlled thumbnail pipeline, bounded retry behavior, and R2 cost/operation review. |
| Medium | Full browser editor coverage | Visual/source mode behavior is unit-tested at the sanitization boundary, not interaction-tested end to end. | Browser tests for mode switching, preview, block changes, and saved output. |
| Medium | Scale-stage query/cache review | Batched taxonomy hydration and paging are present, but 50,000-post/500,000-media operating assumptions need benchmark evidence. | Query-plan review, D1 indexes, keyset/search strategy, and cache invalidation tests. |

## Required Deployment Configuration

The local SSR adapter requires `CANONICAL_ORIGIN` to be the absolute public origin and `SITE_NAME` to be the publication name. The existing Cloudflare binding contract requires `CMS_DB`, `CMS_MEDIA`, `CMS_CACHE`, `CMS_JWT_SECRET`, and `CMS_ORIGIN` as documented in `docs/environment.md`. No secret should be exposed through client environment variables.

The Cloudflare deployment must continue using R2 for bytes, D1 for metadata, KV only where the cache/throttle design is explicitly bounded, and the scheduled Worker for idempotent due-publication promotion. Any decision to add per-request rendering at the edge must be evaluated against the free-plan request and CPU constraints documented in `docs/cloudflare-free-plan.md`.

## Verification Record

The current checkpoint was verified with TypeScript validation, the full Vitest suite, a production build containing both client and SSR bundles, raw HTTP checks against a temporary production process, and screenshot review of the homepage, archive, and public-page miss state. The standing automated evidence is **73 passing tests in 24 files**. This evidence supports the implemented local adapter behavior and should be repeated after every change to routing, data prefetching, authentication, or deployment bindings.

## Requirement Tracker Reconciliation Matrix

The following ledger accounts for every numbered requirement in `todo.md` as of this audit. **Implemented** means the stated capability and named evidence exist. **Partial** means a meaningful portion exists but the requirement's stated completion evidence or delivery target is unfinished. **Open** means the named capability has not yet been sufficiently implemented or verified.

| ID | Requirement area | Status | Audit disposition |
| --- | --- | --- | --- |
| 1 | Cloudflare-compatible deployment architecture | Implemented | Local adapter and D1/R2/KV/Worker deployment artifacts exist. |
| 2 | Core CMS data model | Implemented | Schema covers the stated CMS entities. |
| 3 | Initial roles | Implemented | Superseded by the expanded WordPress-style role matrix. |
| 4 | JWT API tokens | Implemented | Hashing, scopes, revocation, and management are tested. |
| 5 | WordPress REST paths | Implemented | Required collections are present in the local and Pages adapters. |
| 6 | Post/page/custom CRUD and lifecycle | Partial | Persistence and router lifecycle exist; full custom-content integration remains. |
| 7 | Scheduled publishing | Implemented | Guarded scheduled Worker promotion is tested. |
| 8 | Categories and tags | Implemented | CRUD and hierarchy support exist. |
| 9 | Rich Markdown editor | Partial | Structured blocks and preview exist; browser-complete authoring remains. |
| 10 | Media library workflow | Implemented | Upload, metadata, replacement, search, and reference deletion exist. |
| 11 | Premium administration dashboard | Partial | Major panels exist; remaining configuration and completion coverage are open. |
| 12 | Fashion public frontend | Implemented | Homepage, archives, search, taxonomy, detail, and page routes exist. |
| 13 | SEO metadata and crawl controls | Partial | Local SSR and SEO controls exist; Cloudflare edge delivery remains open. |
| 14 | CMS configuration | Partial | Menus, footer, plugins, theme metadata, and indexing exist; trusted custom code does not. |
| 15 | Extension model | Implemented | Registered blocks, hooks, plugin registry, and trust documentation exist. |
| 16 | Cloudflare deployment config | Implemented | Bindings, migration, Functions, and Worker config are documented. |
| 17 | Broad automated coverage | Partial | 73 tests exist; production-binding and browser integration gaps remain. |
| 18 | Public/admin visual verification | Implemented | Responsive public visual verification and local fixes were completed. |
| 19 | Role checks for all mutations | Partial | Broad capability coverage exists; final all-procedure audit remains. |
| 20 | REST token lifecycle | Implemented | Token issuance, storage, revocation, metadata, and UI are present. |
| 21 | Complete administration controls | Partial | Core panels exist; custom code and custom-content completion remain. |
| 22 | E2E REST, visibility, sitemap, noindex | Partial | Local HTTP and route contracts exist; end-to-end binding tests remain. |
| 23 | Per-entry SEO wiring | Partial | Editor/public/local SSR wiring exists; Pages delivery and full test path remain. |
| 24 | Structured Markdown authoring | Partial | Insertion/order/removal exist; full editor UX evidence remains. |
| 25 | End-to-end hardening audit | Implemented | This document and its ledger provide the requirement-level audit. |
| 26 | WordPress-style extended roles | Implemented | Six-role least-privilege model is present. |
| 27 | Administrator user management | Implemented | Listing, role changes, and self-lockout protections are tested. |
| 28 | R2-first storage hardening | Partial | Provider, keying, validation, and metadata exist; derivatives are deferred. |
| 29 | Drag-and-drop multi-file uploads | Partial | UI exists; retry and complete interaction evidence remain. |
| 30 | Protected real-theme previews | Partial | Preview routes and templates exist; full scheduled/page coverage remains. |
| 31 | Visual/source authoring safety | Partial | Modes and sanitization exist; end-to-end mode coverage remains. |
| 32 | Page hierarchy/template separation | Partial | Parent references and public page templates exist; hierarchy delivery remains incomplete. |
| 33 | Theme-level template selection | Implemented | Five template branches are shared and tested. |
| 34 | Public flow/cache audit | Partial | Major routes were reviewed; invalidation and cache evidence remain. |
| 35 | REST compatibility audit | Partial | Strong adapter documentation and contracts exist; final parity audit remains. |
| 36 | Individual/aggregate SEO reporting | Partial | Analysis and bounded summary exist; Cloudflare crawler delivery remains. |
| 37 | Scale review for 50k/500k objects | Partial | Batch hydration and pagination exist; benchmark/index plan remains. |
| 38 | Security completion audit | Partial | Core controls are implemented; custom-code and final audit work remain. |
| 39 | Plugin lifecycle/security audit | Implemented | Reading Time lifecycle and security boundary are tested. |
| 40 | Design tokens | Implemented | Core/admin/theme separation is documented. |
| 41 | Free-plan compatibility review | Implemented | Constraints and intended operating model are documented. |
| 42 | Reading Time lifecycle verification | Implemented | Registration/removal and activation gating are tested. |
| 43 | Administrator role mapping safeguards | Implemented | Mapping and self-lockout coverage are documented. |
| 44 | Visual/source WYSIWYG browser tests | Open | Existing unit safety coverage is not a browser interaction suite. |
| 45 | Recoverable trash workflow | Open | Current REST/admin behavior is permanent deletion. |
| 46 | Router lifecycle regression | Implemented | Create/update/delete/ownership and sitemap state tests exist. |
| 47 | Integration lifecycle coverage | Partial | Scheduled/archived local coverage exists; custom-entry/database integration remains. |
| 48 | Appearance activation controls | Partial | Plugin controls exist; immutable theme is deliberately not switchable. |
| 49 | Persisted plugin activation | Implemented | Reading Time activation gates hooks and editor blocks. |
| 50 | Persisted theme runtime | Implemented | Single-theme runtime and rendered shell fallback tests exist. |
| 51 | Public-shell theme regression | Implemented | Header/newsletter/footer output is tested against malformed metadata. |
| 52 | Theme-consumer resolver routing | Implemented | Public consumers use the runtime boundary or documented direct contract. |
| 53 | Local REST published visibility contract | Implemented | Pagination/search/write/error behaviors are covered. |
| 54 | Markdown block controls | Implemented | Core and plugin block insertion/order/removal are present. |
| 55 | Taxonomy N+1 elimination | Implemented | Batched hydration preserves category/tag contracts. |
| 56 | Cross-origin mutation guard | Implemented | Origin and CSRF write defenses are present. |
| 57 | Same-origin tRPC administration | Implemented | Browser Origin enforcement exists. |
| 58 | CSRF token flow | Implemented | Double-submit header/cookie contract is tested. |
| 59 | Request-level CSRF middleware tests | Implemented | Valid and denied write requests are covered. |
| 60 | REST ownership and deletion | Implemented | PATCH ownership and permanent DELETE envelope are covered. |
| 61 | Public tag archive | Implemented | Published-only tag contract and route exist. |
| 62 | Aggregate SEO summary | Implemented | Bounded administrator summary and dashboard card exist. |
| 63 | Duplicate REST ownership/deletion item | Implemented | Same verified contract as item 60. |
| 64 | R2 original-only strategy documentation | Implemented | Retry, cache, and derivative boundary are documented. |
| 65 | Crawler-visible metadata delivery | Partial | Local SSR is verified; Pages/Workers edge implementation remains open. |

## Conclusion

Atelier CMS has crossed the threshold from prototype into an extensible editorial CMS foundation. Its core security, workflow, media, REST, theme, and administration surfaces are functioning and substantially documented. The most important next release gate is not additional visual polish: it is completing the **Cloudflare-native public metadata delivery path** and database-backed integration coverage, then resolving the intentional trust and recoverability boundaries around custom code and deletion.
