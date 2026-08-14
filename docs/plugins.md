# Plugin Development

Plugins live outside the CMS core. Each plugin exports a manifest and invokes `registerPlugin()` from the extension package. The bundled `reading-time` plugin is a working reference: it subscribes to the `post.public` filter and adds a derived `readingTimeMinutes` field without changing posts, repositories, routes, or theme core.

| Extension point | Use |
| --- | --- |
| `post.public` | Enrich a public post DTO before it reaches a theme or API consumer. |
| `post.created` | React to a newly persisted post. |
| `post.updated` | React to a changed post. |

Editor blocks are registered through `registerEditorBlock({ type, label, markdown })` from `server/cms/blocks.ts`. Core blocks provide heading, paragraph, quote, image, and divider inserts. The Reading Time plugin also registers an example extension block. This model lets a future theme or plugin contribute editor affordances without changing core editor services.

To add a plugin, create a package beneath `plugins/`, export a `CmsPlugin` manifest, and import the package in `plugins/registry.ts`. The registry is the extension boundary, not a CMS-core file. A Cloudflare deployment can use the same registry at build time, which keeps plugin loading edge-compatible and avoids runtime filesystem discovery.
