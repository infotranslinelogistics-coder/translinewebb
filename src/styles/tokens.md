# Transline design tokens

The palette is sampled from `src/assets/Translines (2).png`. The artwork contains three flat colours: Transline red `#BE1C2D`, supporting grey `#A6A6A6`, and white `#FFFFFF`.

## Colour

| Token | Value | Role |
| --- | --- | --- |
| `brand.raw` | `#BE1C2D` | Exact logo red; logo lockups and filled controls with white text |
| `brand.primary` | `#BE1C2D` | Primary actions and active navigation |
| `brand.primary-bright` | `#E2485A` | Small red text, lines, and focus indicators on the dark surface |
| `brand.secondary` | `#A6A6A6` | Supporting routes, secondary data, inactive states |
| `surface.dark` | `#0B0C0D` | Marketing and navigation shell |
| `surface.dark-raised` | `#141618` | Raised dark regions without shadows |
| `surface.light` | `#F5F2EB` | Portal and admin work surface |
| `surface.white` | `#FFFEFA` | Forms and data table rows |
| `neutral.100–900` | `#E7E4DC` → `#17191B` | Dividers, secondary copy, and structure |
| `signal.success` | `#18794E` | Confirmed and active |
| `signal.warning` | `#A86408` | Due and attention |
| `signal.error` | `#A61B29` | Destructive action and failure |

White on `brand.primary`, `brand.primary-bright` on `surface.dark`, and `neutral.900` on `surface.light` meet WCAG AA for normal text. The exact logo grey is not used for small text on light surfaces.

## Type

- Display: Barlow Condensed, weights 600–800, local Latin WOFF2 files.
- Body and interface: Inter, weights 400–600, local Latin WOFF2 file.
- Scale: `text-display`, `text-h1`, `text-h2`, `text-h3`, `text-h4`, `text-body`, `text-caption`, and `text-data`.
- Operational values use `font-variant-numeric: tabular-nums` through the `.data-value` utility.

## Space and shape

- Marketing sections use fluid horizontal gutters between `1.25rem` and `4.5rem` and generous vertical rhythm.
- Portal/admin surfaces use tighter 16–24px spacing and one-pixel dividers.
- Corners are limited to functional controls and overlays. Main sections and data regions stay square.
- Shadows are avoided; contrast, borders, and spacing create hierarchy.

## Motion

- The route map owns the only ambient motion on marketing pages.
- Portal/admin motion is reserved for panels and action confirmation.
- `prefers-reduced-motion` disables route drawing and travelling markers while leaving routes visible.
