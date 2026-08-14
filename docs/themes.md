# Theme Development

Themes belong under `client/src/themes/` and only consume public CMS procedures and presentation data. The included `fashion` theme is the first implementation. It owns fashion-specific navigation defaults, imagery, card composition, the masthead, archive layout, newsletter panel, and article visual language; the CMS core has no fashion categories or fashion-only fields.

A new theme can replace its page templates, layout components, design tokens, default navigation, and theme settings while preserving the same content, media, taxonomy, settings, and REST contracts.
