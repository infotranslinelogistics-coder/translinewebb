# Freelancer Handoff

## Project Overview

This repo contains two related web apps:

- Main marketing site at `/`
- Admin portal at `/portal`

The stack is React + Vite + TypeScript. The portal uses Supabase for auth and data access. The root dev server is an Express wrapper that mounts both Vite apps on one port.

## What Matters First

- Start the full local environment from the repo root with `npm run dev`
- The main site should load at `http://localhost:5173`
- The portal should load at `http://localhost:5173/portal`
- Build the portal with `cd portal && npm run build`

## Key Files

- `dev-server.js`: unified local dev server for main site and portal
- `server.js`: production Express server
- `portal/src/pages/ShiftsPage.tsx`: shift list and shift details modal
- `portal/src/pages/DriversPage.tsx`: driver list and current shift/break state
- `portal/src/pages/VehiclesPage.tsx`: vehicle CRUD and assignments
- `portal/src/pages/LiveMapPage.tsx`: current live map page surface
- `portal/src/lib/db/shifts.ts`: shift queries and enrichment helpers
- `portal/src/lib/db/vehicles.ts`: vehicle queries and assignment-aware listing

## Current State

- Portal and main site run from the same dev server
- Portal React runtime conflict was mitigated in `portal/vite.config.ts`
- Shift Details modal exists on the portal Shifts page
- Shift Details currently includes:
  - Overview
  - Checklist summary and parsed checklist items
  - Break summary from `shift_events`
  - GPS/location event summary
  - Full event timeline
- Portal build passes as of the latest local validation

## Data Notes

- Use existing schema only; do not assume backend schema changes are available
- `shift_events` is the main event stream for shift activity
- Break status is derived from `break_start` and `break_end`
- Some live Supabase views expose fewer columns than older frontend assumptions
- The portal code has already been adjusted in several places to tolerate sparse/null live data

## Recent High-Value Changes

- Added `/api/admin/create-driver` alias for local/prod admin route compatibility
- Fixed portal manifest/icon paths in `portal/index.html`
- Hardened portal Vite config to prefer a single React runtime
- Fixed vehicle reads to avoid non-existent live columns
- Reworked vehicle creation to insert directly through Supabase
- Added and then cleaned up Shift Details modal rendering logic, including null-safe checklist handling

## Known Expectations

- The repo may have unrelated in-progress changes; do not revert them blindly
- If something in portal data looks incomplete, check whether the live Supabase view/table actually exposes that column before editing UI types
- WebSocket/HMR behavior is routed through the custom dev server rather than plain standalone Vite

## Suggested First Checks

1. Run `npm run dev` from repo root
2. Open the portal Shifts page
3. Open a Shift Details modal and verify checklist, breaks, and timeline render
4. Run `cd portal && npm run build`
5. Inspect `dev-server.js`, `portal/vite.config.ts`, and `portal/src/pages/ShiftsPage.tsx` before changing infrastructure or shift UI again

## Working Style Notes

- Keep fixes minimal and schema-aware
- Prefer direct validation after each UI/data change
- Avoid adding docs unless explicitly requested

## Unified visual rebuild — 2026-09-06

The rebuild lives on `codex/unified-platform-rebuild`, branched from `claude/ecstatic-volta-okova0`.

Completed in this pass:

- Sampled the committed logo: red `#BE1C2D`, grey `#A6A6A6`, white `#FFFFFF`.
- Added named Tailwind brand/surface/neutral/signal tokens and the documented type scale.
- Added local Latin WOFF2 files for Barlow Condensed (display) and Inter (body/UI).
- Rebuilt the marketing home experience around the shared, data-driven `src/components/RouteMap/` component.
- RouteMap supports `hero`, `portal`, and `tracking` variants with a real Natural Earth coastline, geographic point projection, optional 3D depth, pointer tilt, zoom, keyboard selection and reduced motion. The former illustrative routes and schedules have been removed.
- Rebuilt the marketing sections: service capability, coverage, fleet, process, tracking handoff, quote request, operations facts, and footer.
- Flipped portal work surfaces to warm light while retaining the dark navigation shell; replaced the orange accent with the sampled Transline red and tightened cards/tables.
- Rebuilt the portal sign-in surface and added the shared approved-delivery map to the authenticated dispatch dashboard. Existing live driver GPS remains in Live Map.
- Updated the React Native admin shell to the same light work surface, dark navigation and brand/signal tokens.
- Updated the iOS splash/status-bar colours to the dark Transline shell.
- Added a branded Open Graph card and matching page metadata.

Deferred / requires operations input:

- Confirm the public fleet figures (four vehicle classes, 14-tonne top listed capacity, company-owned fleet) before production publishing.
- Commission real depot, driver, container and road-train photography. The rebuild intentionally uses no stock photography.
- Add real, approved town/suburb delivery locations to `src/data/approved-deliveries.json`. It is empty: the repository contains GPS stops and completed shifts, neither of which establishes a delivery. Do not publish private GPS, customer addresses, driver identifiers or shift events. See `docs/MARKETING_SEO_AND_MAP.md` for the contract.
- Full driver iOS UX rebuild remains separate. This pass covers shell colours, splash and status bar only.
- The tracked `app-sync.patch` and `my_changes.patch` target older file layouts and do not apply cleanly in either direction on this branch. They were reviewed and preserved unchanged.

## Marketing pages, geography and motion — 2026-09-06 follow-up

- Header, mobile navigation and footer all use the sampled logo red `#BE1C2D`.
- Every public header destination now has a dedicated route: `/freight`, `/coverage`, `/fleet`, `/driver-tracking`, `/about`. Admin login remains `/portal/login`.
- Added contact, quote, service detail, locality and postcode pages. Quotes prepare an email to send, with no false submission-success state.
- Builds emit 2,194 static HTML pages: 1,768 filtered WA locality/postcode records, 382 postcode groups, and 44 main/service/directory pages. Each page has its own title, description, canonical and structured data; three XML sitemaps cover all pages.
- The directory is geographic reference material, not evidence of past work, guaranteed coverage, route distances or delivery schedules. Sources, licences and quality filters are in `src/data/geography-sources.json`.
- `SITE_URL` sets the production canonical origin during build; default remains the existing `https://translinewebb.vercel.app`. Change it to a verified custom domain when one is connected.
- Production marketing URLs return rendered HTML without JavaScript. Unknown URLs return a real 404. Admin routes have noindex metadata and response headers.
- Hero map uses a layered geographic surface, pointer tilt and a 2D/3D toggle. Motion includes staggered entry, a finite typography sweep, hover feedback and supported browser page transitions. Reduced-motion preferences disable animation.
- `npm run typecheck:marketing` checks the active marketing entry graph. The older unreferenced `src/components/ui` files still contain pre-existing version-suffixed imports; they are not included in the marketing build.
- Verification: `npm run build`, `npm run typecheck:marketing`, `npm run verify:site`, and `npm --prefix portal test`.
