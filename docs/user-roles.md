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

## API Tokens

Tokens are JWTs with a role claim and explicit scopes. They are stored only as a SHA-256 hash and may be revoked. A token never grants a capability that its issuer role does not have; applications should request only the scopes required for the integration.
