# Browser Editor Testing

The public smoke suite runs without an authenticated session. The editor interaction suite is intentionally separate because its browser flow needs an administrator context to open the CMS editor.

Run the isolated editor test with `pnpm test:e2e:editor`. This command starts an independent development server on port `3100` with both `CMS_E2E_TEST_AUTH=1` and `VITE_CMS_E2E_TEST_AUTH=1`. The server creates the deterministic in-memory test editor only when all of the following conditions hold:

| Guard | Required value |
| --- | --- |
| Runtime | `NODE_ENV=development` |
| Server switch | `CMS_E2E_TEST_AUTH=1` |
| Browser request marker | `x-cms-e2e-test-auth: enabled` |

The fixture is not available to a production process, normal local sessions, or requests lacking the exact marker. Unit coverage verifies both the opt-in path and the production denial path.

| Browser test | Verified result |
| --- | --- |
| `editor-modes.spec.ts` | Opens a post, round-trips rich visual/source HTML, and verifies that a strict empty sandbox keeps unsafe preview script from reaching the parent page. |
| `media-upload.spec.ts` | Rejects an unsupported file before network upload, displays a retryable failed queue item, reports a completed upload, persists title/description metadata, and removes the temporary test asset. |
| `admin-critical-path.spec.ts` | Creates and publishes a post from the dashboard, verifies public homepage, archive, and search visibility, confirms trash removes it from the homepage and archive, permanently cleans it up, and verifies a saved header menu appears in the public shell before restoring prior configuration. |
| `graphical-editor.spec.ts` | Composes heading, list, table, approved embed, and structured widget blocks; verifies the graphical preview; uploads an image through an image block into the R2-backed media library; persists alternative text/caption; reopens the draft to verify serialization; and cleans up the temporary record. |

The complementary real-repository lifecycle integration test in [`server/cms/realPublication.integration.test.ts`](../server/cms/realPublication.integration.test.ts) proves that homepage/archive data, category, tag, search, and sitemap readers all follow publish, archive, trash, and restore transitions.
