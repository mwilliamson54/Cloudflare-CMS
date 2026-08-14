# CMS Design System

The CMS uses a shared token foundation in `client/src/index.css`. It defines the semantic colors, radii, typography defaults, interactive focus treatments, dashboard/sidebar colors, and light/dark theme variants consumed by the component library.

| Layer | Responsibility | Location |
| --- | --- | --- |
| Core tokens | Semantic surface, text, border, focus, destructive, chart, and radius values. | `client/src/index.css` |
| Component library | Inputs, dialogs, selects, buttons, tables, and accessible interaction primitives. | `client/src/components/ui/` |
| Administration | Editorial operations, data density, form patterns, and dashboard navigation. | `client/src/pages/Admin.tsx`, `client/src/components/DashboardLayout.tsx` |
| Public theme | Fashion-magazine layout, art direction, default assets, cards, header, footer, and article presentation. | `client/src/themes/fashion/`, `client/src/components/FashionLayout.tsx` |

The admin and public theme intentionally share semantic primitives but do not share page-layout components. This keeps operational tools efficient and accessible while allowing the public magazine to retain its editorial visual identity.

> New themes should use the core semantic tokens for accessible controls, then define their own layout and editorial presentation under `client/src/themes/{theme-key}/`. Administrative components must not import theme-specific layout code.
