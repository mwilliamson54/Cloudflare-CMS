# Browser Editor Testing

The public smoke suite runs without an authenticated session. The editor interaction suite is intentionally separate because its browser flow needs an administrator context to open the CMS editor.

Run the isolated editor test with `pnpm test:e2e:editor`. This command starts an independent development server on port `3100` with both `CMS_E2E_TEST_AUTH=1` and `VITE_CMS_E2E_TEST_AUTH=1`. The server creates the deterministic in-memory test editor only when all of the following conditions hold:

| Guard | Required value |
| --- | --- |
| Runtime | `NODE_ENV=development` |
| Server switch | `CMS_E2E_TEST_AUTH=1` |
| Browser request marker | `x-cms-e2e-test-auth: enabled` |

The fixture is not available to a production process, normal local sessions, or requests lacking the exact marker. Unit coverage verifies both the opt-in path and the production denial path. The browser test opens a new post, applies a normal rich-text bold command in the visual editor, verifies its HTML representation in source mode, changes safe source HTML and verifies the visual-mode round trip, then opens a source preview containing a script. It confirms that the preview uses a strict empty `sandbox` attribute and that the script cannot set state on the parent page.
