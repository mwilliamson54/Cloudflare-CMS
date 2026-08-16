# Cloudflare Admin Client to Pages Adapter Parity Matrix

This matrix was generated from the client-side `trpc.*` calls under `client/src/pages` and `client/src/components` and compared with `functions/api/trpc/[[path]].ts`. The Cloudflare adapter uses the same procedure names and accepts the dashboard’s existing input contracts for the CMS administration surface.

| Client procedure | Pages adapter | Evidence |
| --- | --- | --- |
| `cms.bootstrap` | Implemented | Direct adapter source and admin procedure tests |
| `cms.apiTokens.create` | Implemented | JWT issuance test plus REST verifier acceptance |
| `cms.apiTokens.list` | Implemented | Adapter source and role enforcement |
| `cms.apiTokens.revoke` | Implemented | Adapter source and role enforcement |
| `cms.appearance.get` | Implemented | `cloudflareAdminProcedures.test.ts` parity test |
| `cms.appearance.update` | Implemented | Adapter source with administrator enforcement |
| `cms.categories.create/delete/list/update` | Implemented | Content/taxonomy adapter source and taxonomy regression coverage |
| `cms.content.create/delete/list/preview/restore/trash/update` | Implemented | Content adapter source, lifecycle integration coverage, and protected preview ownership checks |
| `cms.contentTypes.create/list` | Implemented | `cloudflareAdminProcedures.test.ts` parity test |
| `cms.editorBlocks` | Implemented | `cloudflareAdminProcedures.test.ts` parity test |
| `cms.media.delete/list/replace/update/upload` | Implemented | Adapter source, media validation tests, and R2 workflow coverage |
| `cms.menus.list/save` | Implemented | `cloudflareMenuAdapter.test.ts` administrator persistence and editor denial tests |
| `cms.seo.summary` | Implemented | `cloudflareAdminProcedures.test.ts` bounded summary and role tests |
| `cms.settings.get/update` | Implemented | Adapter source with administrator mutation enforcement |
| `cms.tags.create/delete/list/update` | Implemented | Content/taxonomy adapter source and taxonomy regression coverage |
| `cms.users.list/updateRole` | Implemented | Adapter source with administrator and self-lockout checks |
| `site.categoryPosts`, `site.menus`, `site.page`, `site.post`, `site.posts`, `site.settings`, `site.tagPosts` | Existing public delivery contract | Public server router and publication visibility integration tests; these are not admin mutations |
| `ai.chat` | Existing Manus-only development integration | Intentionally outside the Cloudflare free-plan CMS adapter; the Pages production admin does not depend on this procedure |

## Verification boundary

The matrix confirms procedure-name parity and focused contract coverage. Live D1/R2 binding verification remains blocked until the Cloudflare account has a persistent D1 database and R2 is enabled. The production resource and browser mutation requirements therefore remain open in `todo.md` even though the adapter contracts are implemented locally.
