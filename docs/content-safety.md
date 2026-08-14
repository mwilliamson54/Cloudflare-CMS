# Content Authoring Safety

The editor supports two source modes: **Markdown** for ordinary editorial work and **HTML source** for controlled custom markup. Markdown is rendered through the existing safe renderer. HTML source is never trusted directly.

| Stage | Safety behavior |
| --- | --- |
| Browser preview | HTML source is rendered only in a sandboxed iframe with scripts disabled. |
| Server persistence | The CMS runs an explicit allowlist sanitizer before writing `bodyHtml`. |
| Allowed elements | Editorial text, headings, lists, links, figures, images, code, and basic inline formatting. |
| Rejected input | Scripts, styles, iframes, forms, SVG/MathML blocks, event handlers, unsupported tags, unsafe URLs, and non-safe classes. |
| External links | `_blank` links receive `rel="noopener noreferrer"`. |

Source mode is intended for trusted editors, not arbitrary public input. Administrators should keep plugin code and custom code separate from article HTML; those are higher-risk surfaces and require code review before deployment.
