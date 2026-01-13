-- Migration: Add vehicle assignment fields and RLS policies

-- 1) Add columns to vehicles for single active assignment per driver
ALTER TABLE IF EXISTS vehicles
  ADD COLUMN IF NOT EXISTS assigned_driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- 2) Ensure a driver can have at most one active assigned vehicle
-- Unique partial index: only considers rows with assigned_driver_id and is_active = true
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'i' AND c.relname = 'one_active_vehicle_per_driver'
  ) THEN
    CREATE UNIQUE INDEX one_active_vehicle_per_driver ON vehicles (assigned_driver_id) WHERE (assigned_driver_id IS NOT NULL AND is_active = true);
  END IF;
END$$;

-- 3) Row Level Security: restrict modifications to admins only
-- Allow authenticated users to SELECT vehicles
ALTER TABLE IF EXISTS vehicles ENABLE ROW LEVEL SECURITY;

-- Allow any authenticated user to SELECT
CREATE POLICY IF NOT EXISTS "Allow select for authenticated" ON vehicles FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Allow admins (profiles.role = 'admin') to INSERT
CREATE POLICY IF NOT EXISTS "Admins can insert vehicles" ON vehicles FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Allow admins to UPDATE
CREATE POLICY IF NOT EXISTS "Admins can update vehicles" ON vehicles FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Allow admins to DELETE
CREATE POLICY IF NOT EXISTS "Admins can delete vehicles" ON vehicles FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- 4) (Optional) If you use a drivers table and want admins to SELECT drivers too, ensure drivers RLS allows SELECT for authenticated users
ALTER TABLE IF EXISTS drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "Allow select drivers for authenticated" ON drivers FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Note: Supabase's "auth.uid()" and profiles table are used to map JWT -> user profile. Ensure you have a `profiles` table with `id` and `role` columns.
-- Apply this migration with psql or via Supabase SQL editor.
