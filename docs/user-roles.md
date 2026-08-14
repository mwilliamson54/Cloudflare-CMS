# CMS User Roles and Privileges

The CMS uses a **least-privilege** role model modeled on WordPress while preserving the existing `admin` role identifier. In the UI, `admin` is displayed as **Administrator**.

| Role key | UI name | Content privileges | Administrative privileges |
| --- | --- | --- | --- |
| `admin` | Administrator | Read, create, edit, publish, schedule, archive, and manage all content. | Manage users and roles, settings, API tokens, media, taxonomies, content types, themes, and trusted plugins. |
| `editor` | Editor | Read, create, edit, publish, schedule, archive, and manage all editorial content. | Manage media, taxonomies, and their own API tokens. Cannot manage users or global site settings. |
| `author` | Author | Read, create, edit, publish, schedule, and archive **only their own** content. | Upload media and manage their own API tokens. Cannot manage taxonomies, users, or site settings. |
| `contributor` | Contributor | Read, create, and edit **only their own drafts**. | Upload media. Cannot publish, schedule, manage taxonomies, users, or settings. |
| `subscriber` | Subscriber | Read published public content. | No CMS mutation privileges. |
| `viewer` | Viewer (compatibility) | Read published public content. | Legacy read-only compatibility role; no CMS mutation privileges. |

## Enforcement Rules

The central capability policy is enforced on every protected CMS procedure. Author and contributor mutations also check `authorId`, preventing cross-author updates. User listing and role changes require Administrator privileges. An Administrator cannot remove their own Administrator access through the management API or user interface.

The automated authorization audit combines exhaustive central-capability assertions with a direct procedure-by-procedure mutation matrix. The matrix executes every CMS mutation for an Administrator and denies every one before a Subscriber repository write; focused positive paths cover Editor taxonomy, token, and media work, Author token ownership, and Contributor-owned draft lifecycle work. Viewer coverage, separate lifecycle tests, and REST tests verify read-only, ownership, publication, media, trash/restore, and permanent-delete boundaries.

## API Tokens

Tokens are JWTs with a role claim and explicit scopes. They are stored only as a SHA-256 hash and may be revoked. A token never grants a capability that its issuer role does not have; applications should request only the scopes required for the integration.
