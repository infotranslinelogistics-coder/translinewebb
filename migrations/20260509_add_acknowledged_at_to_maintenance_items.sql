alter table public.maintenance_items
add column if not exists acknowledged_at timestamptz;
