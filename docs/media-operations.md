# Media Operations and Delivery Strategy

Atelier CMS stores media bytes in the configured object provider and keeps only metadata and object references in the CMS database. The current Cloudflare deployment writes original files to R2 under `uploads/YYYY/MM/u{userId}/filename.ext`; public delivery uses a stable object-key route with immutable, one-year cache headers. The browser media library validates type and 10 MB size before upload, while the server repeats validation before persistence.

## Upload and Retry Behavior

Multi-file uploads are processed sequentially so the client can show accurate remaining-file feedback and avoid overwhelming a free-tier Worker or storage binding. Each file has an isolated error path: a failed file reports its own error and does not discard successfully stored neighboring files. Editors may retry the failed file by selecting or dropping it again; a later replacement preserves the stable media ID used by content references.

The current upload protocol uses base64 through the authenticated CMS adapter and is intentionally capped at 10 MB. For larger assets or high-volume ingestion, move to presigned/direct R2 multipart uploads before increasing size limits; this avoids passing large payloads through Pages Functions.

## Thumbnail Strategy

The initial free-tier deployment serves originals and uses CSS object fitting for the editorial grid. It does not invoke a runtime image transformation service, generate thumbnails in a database, or create derivative files during a request. This keeps read paths deterministic and avoids surprise paid image-resizing usage.

When traffic or original-image dimensions justify derivatives, use a controlled write-time pipeline that records a derivative manifest beside the original R2 key. Generate a small approved set of widths (for example, card and hero sizes), preserve the original as the source of truth, and update the public media response only after derivative creation succeeds. The delivery route’s immutable cache policy is safe because replacements receive a new object key while the media record retains its stable identifier.

## Operational Limits

The media library is paginated and searchable. Metadata fields include original filename, accessible alternative text, caption, title, description, provider, MIME type, size, and stable storage key. Authors should provide alternative text at upload or edit time; the CMS does not infer accessibility metadata. Object deletions are explicit CMS operations, and content references should be reviewed before removal.
