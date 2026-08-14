# Content Lifecycle Integration Coverage

The CMS integration suite uses the configured development repository with temporary records and cleanup, rather than repository doubles, for publication and content-administration paths. It covers the expected lifecycle isolation between private editorial states and public reads.

| Content type | Verified operations | Public visibility contract |
| --- | --- | --- |
| Posts | REST draft and scheduled create, collection and individual reads, publish update, archive update, trash, and force delete | Draft, scheduled, and archived records are absent from public reads and the sitemap. Published indexed records enter the sitemap; published noindex records do not. |
| Pages | REST draft and scheduled create, publish update, collection and individual reads, title update, archive update, and force delete | Draft, scheduled, and archived pages are absent from public reads and the sitemap until publication. Published pages retain page-type routing. |
| Custom entries | Administrator create, read, list, scheduled state, publish update, archive update, trash, restore, and permanent delete | Draft, scheduled, archived, and trashed entries remain absent from the generic public custom-entry lookup. A published custom entry becomes available with its field data. |

Each test creates unique timestamped slugs and removes created records and temporary custom content types after completion. The test suite therefore validates persistence and visibility against the real development database without leaving fixture data behind.
