# Supabase verification — TransLine (admin portal + driver app)

This checks that the live Supabase project provides every database object the two
apps depend on. A missing view / function / bucket (or RLS enabled with no policy)
is the usual cause of "page loads but is empty", "photos won't display", or an
action that silently fails.

There are two checks plus this reference:

| File | Covers | Who runs it |
|------|--------|-------------|
| `scripts/verify_supabase.mjs` | 25 tables/views (existence) | Anyone — uses the **public anon key**, read-only |
| `scripts/verify_supabase.sql` | tables/views **+ 14 functions + 3 buckets + RLS** | Run in the **Supabase SQL editor** (admin/service-role) |

> The anon REST probe can only confirm relations. It intentionally does **not**
> touch RPCs (calling `start_shift` / `force_end_shift` / `delete_*` could mutate
> data) or buckets (introspection is locked to anon). Use the SQL script for those.

## How to run

**Relations (immediate, no secrets):**
```bash
node scripts/verify_supabase.mjs
# or against a specific project:
SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/verify_supabase.mjs
```

**Functions + buckets + RLS (authoritative):** open the Supabase dashboard →
SQL editor → paste `scripts/verify_supabase.sql` → Run. Rows with `MISSING` or
`WARN` sort to the top.

## Result (authoritative SQL check, project `fjllbnhcyugxltiresjp`, 2026-06-15)

**3 objects MISSING; everything else present.**

| Object | Kind | Impact if missing |
|--------|------|-------------------|
| `driver_status_events` | table | Driver-profile **status history** + live status updates (`useDriverPresence`); also blocks the unapplied view migration (see below) |
| `driver_push_tokens` | table | **Push notifications** can't be delivered — the app's token save fails (caught, non-fatal) so no tokens are ever stored |
| `delete_driver_log_admin` | function | Portal **Logs page "Delete"** fails (the sibling `delete_fuel_log_admin` exists) |

Everything else is healthy:
- 23/25 tables/views present; 13/14 functions present.
- All 3 buckets present **and private** (`public=false`) ✅ — photo previews are fine.
- **No RLS-without-policy warnings.**

### Notable: an unapplied migration
`migrations/20260520_recreate_view_driver_current_status.sql` defines `view_driver_current_status`
to select **from `driver_status_events`**. That table is missing, yet the view exists — which is only
possible if **that migration was never applied** (Postgres won't create a view over a missing table).
So the live view is an older definition, and applying the migration will fail until `driver_status_events`
is created first.

> ⚠️ The anon REST probe (`verify_supabase.mjs`) initially reported these as "present" because this
> project returns a **blanket 403** for the anon role on every relation, which hides the missing-vs-denied
> distinction. The probe now reports such responses as `denied` and warns. **The SQL catalog check is
> authoritative.**

## Object → feature map (what breaks if it's MISSING)

### Tables / views
| Object | Powers |
|--------|--------|
| `drivers`, `drivers_full`, `view_driver_current_status`, `drivers_with_current_vehicle` | Drivers list/profile, live status, shift↔driver mapping |
| `vehicles`, `vehicles_with_driver`, `vehicle_latest_odometer` | Vehicles list/profile, current odometer |
| `shifts`, `shifts_full` | Shifts page, Shift Details, Live Map, Dashboard |
| `shift_events` | Shift Details timeline; fuel/odometer/break/incident/stop events; Live Map route |
| `profiles` | Admin role gate (portal login + admin API authz) |
| `vehicle_assignments` | Driver↔vehicle assignment |
| `driver_presence`, `view_driver_latest_location` | Live Map presence & latest location |
| `maintenance_items`, `vehicle_service_alerts` | Maintenance page, Dashboard alerts, Inbox |
| `odometer_readings`, `odometer_readings_admin` | Odometer Logs page, vehicle odometer history |
| `driver_status_events` | Driver status history (Driver profile) |
| `driver_logs_admin` | Logs page (incident/driver logs) |
| `checklist_approvals`, `checklist_approval_requests` | Checklist Approvals (app requests → portal approves) |
| `activity_logs`, `admin_audit_logs` | Admin activity / audit displays |
| `driver_push_tokens` | Push-notification registration (app) |

### Functions (RPCs)
| Function | Powers |
|----------|--------|
| `start_shift`, `end_shift` | App: start / end a shift |
| `start_break`, `end_break` | App: break control |
| `request_checklist_approval` | App: request checklist approval |
| `approve_checklist_request`, `reject_checklist_request` | Portal: Checklist Approvals actions |
| `log_idle_event` | App: idle / stop logging |
| `force_end_shift` | Portal: Shifts page "Force End" |
| `delete_shift_admin`, `delete_fuel_log_admin`, `delete_driver_log_admin` | Portal: delete shift / fuel log / driver log |
| `assign_vehicle`, `unassign_driver` | Portal: vehicle assignment |

### Storage buckets
| Bucket | Powers | Expected |
|--------|--------|----------|
| `odometer_photos` | Start/end odometer photos (app upload, portal view) | **private** + signed URLs |
| `fuel_receipts` | Fuel Logs receipt previews | **private** + signed URLs |
| `driver_log_photos` | Incident / driver-log photos (Logs page) | **private** + signed URLs |

Each bucket needs storage RLS allowing **drivers to upload** their own files and
**admins to read** (signed-URL generation). If buckets are missing or policies are
wrong, the rows still load but photo thumbnails fail.

## Environment variables (3 separate sets — don't mix them up)
| Where | Vars |
|-------|------|
| Mobile app (EAS build / `.env`) | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (also baked into `app.json`/`eas.json`) |
| Portal frontend (Vite build) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| Admin API (Vercel functions / `server.js`) | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |

## Notes / open questions
- The probe targets the app's committed project `fjllbnhcyugxltiresjp`. **Confirm the
  portal's `VITE_SUPABASE_URL` points to the same project**; if not, run both checks
  against the portal's project too.
- The anon key + project URL are public by design; the **service-role key is secret** —
  keep it in env/secret stores, never in chat or the repo.
