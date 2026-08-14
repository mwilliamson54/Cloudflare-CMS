# Browser Interaction Test Boundary

Playwright runs against the existing local CMS server through `pnpm test:e2e`. The initial configuration deliberately has **no authentication bypass**: production authentication remains unchanged, and privileged editor flows require an explicit future test-session fixture that is safe only under `NODE_ENV=test`.

The first browser specifications should cover authenticated editor mode switching, `contentEditable` visual input, HTML-source updates, and sandboxed preview behavior. Server-side sanitizer, content ownership, and public noindex checks continue to be exercised by Vitest while that fixture is designed.
