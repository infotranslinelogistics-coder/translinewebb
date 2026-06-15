#!/usr/bin/env node
// Read-only existence probe for the tables/views the TransLine apps query.
//
// It sends `GET /rest/v1/<relation>?select=*&limit=0` (zero rows) with the
// public anon key. A missing relation returns 404 / PGRST205; an existing one
// (even when RLS hides all rows) returns 200/401/403. So it confirms existence
// WITHOUT reading any data and WITHOUT mutating anything.
//
// It deliberately does NOT probe RPC functions: calling them with valid args
// could mutate data (start_shift, force_end_shift, delete_*, end_break, ...),
// and with invalid args PostgREST's "not found" is ambiguous. Verify functions,
// buckets and RLS with scripts/verify_supabase.sql instead.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/verify_supabase.mjs
//   (falls back to the committed app project if env vars are unset)

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  'https://fjllbnhcyugxltiresjp.supabase.co';

const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqbGxibmhjeXVneGx0aXJlc2pwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5ODAyNzMsImV4cCI6MjA4NzU1NjI3M30.alLINSopMh0fhu-Ae0kUbczNXdTVlk-JtWMMEpgjeuI';

const RELATIONS = [
  'activity_logs', 'admin_audit_logs', 'checklist_approval_requests',
  'checklist_approvals', 'driver_logs_admin', 'driver_presence',
  'driver_push_tokens', 'driver_status_events', 'drivers', 'drivers_full',
  'drivers_with_current_vehicle', 'maintenance_items', 'odometer_readings',
  'odometer_readings_admin', 'profiles', 'shift_events', 'shifts',
  'shifts_full', 'vehicle_assignments', 'vehicle_latest_odometer',
  'vehicle_service_alerts', 'vehicles', 'vehicles_with_driver',
  'view_driver_current_status', 'view_driver_latest_location',
];

async function probe(rel) {
  const url = `${SUPABASE_URL}/rest/v1/${rel}?select=*&limit=0`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Accept: 'application/json',
      },
    });
    if (res.status === 200) return { rel, status: 'present', detail: '200 (readable by anon)' };
    if (res.status === 401 || res.status === 403)
      return { rel, status: 'present', detail: `${res.status} (exists, RLS/permission)` };
    if (res.status === 404) {
      let code = '';
      try { code = (await res.json())?.code || ''; } catch {}
      return { rel, status: 'MISSING', detail: `404 ${code}`.trim() };
    }
    return { rel, status: 'unknown', detail: `HTTP ${res.status}` };
  } catch (err) {
    return { rel, status: 'error', detail: err?.cause?.code || err?.message || 'network error' };
  }
}

const results = [];
for (const rel of RELATIONS) results.push(await probe(rel));

const pad = (s, n) => String(s).padEnd(n);
console.log(`\nProject: ${SUPABASE_URL}`);
console.log(pad('RELATION', 30), pad('STATUS', 9), 'DETAIL');
console.log('-'.repeat(70));
for (const r of results.sort((a, b) => a.status.localeCompare(b.status) || a.rel.localeCompare(b.rel))) {
  console.log(pad(r.rel, 30), pad(r.status, 9), r.detail);
}

const missing = results.filter((r) => r.status === 'MISSING');
const errored = results.filter((r) => r.status === 'error');
console.log('-'.repeat(70));
console.log(`present: ${results.filter((r) => r.status === 'present').length}/${RELATIONS.length}` +
  `  missing: ${missing.length}  errored: ${errored.length}`);
if (errored.length) {
  console.log('\nNote: network may be blocked from this environment. If everything errored,');
  console.log('run scripts/verify_supabase.sql in the Supabase SQL editor instead.');
}
if (missing.length) {
  console.log('\nMISSING relations:', missing.map((r) => r.rel).join(', '));
  process.exitCode = 1;
}
