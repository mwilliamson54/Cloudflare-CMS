# Plugin Security and Lifecycle

CMS plugins are **trusted application extensions**, not untrusted marketplace packages. A plugin can register server-side hooks and editor blocks; it therefore runs with the application’s privileges and must be reviewed, versioned, and deployed through the same change-control process as core code.

## Lifecycle safeguards

1. Plugins are registered by stable keys and only once per runtime.
2. Every hook is recorded with its owning plugin key.
3. `unregisterPlugin(key)` removes all hooks owned by that plugin before removing its registration.
4. The reading-time plugin is the integration reference: automated tests prove that its public-post enrichment disappears after removal and returns after explicit re-registration.

## Trust boundaries

| Capability | Allowed | Constraint |
| --- | --- | --- |
| Hook registration | Yes | Plugins receive a narrow hook registrar, not database or request internals. |
| Editor block registration | Yes | Blocks are static metadata; editor output still passes normal content-safety handling. |
| Arbitrary runtime package installation | No | There is no public plugin marketplace or runtime package uploader. |
| Direct database access | Not supplied by the plugin API | Any code-level plugin change remains subject to code review. |
| Custom executable code from CMS users | No | Source HTML is sanitized; it is not a plugin execution channel. |

> Enable only reviewed plugins from the project repository. Treat a plugin update as a production code deployment and rerun the regression suite before release.
