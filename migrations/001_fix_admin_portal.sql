-- Migration: Fix Admin Portal - Add RLS policies and storage bucket for odometer photos

-- Create admin_actions table for audit logging
CREATE TABLE IF NOT EXISTS public.admin_actions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  admin_name text NOT NULL,
  action_type text NOT NULL,
  target_id uuid,
  target_type text,
  reason text,
  metadata jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Add RLS policies for admin_actions
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "admins_read_admin_actions" ON public.admin_actions 
FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

CREATE POLICY IF NOT EXISTS "admins_insert_admin_actions" ON public.admin_actions 
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_admin_actions_created_at ON public.admin_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_actions_action_type ON public.admin_actions(action_type);

-- Create odometer photos storage bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('odometer-photos', 'odometer-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Add admin policies for fuel_logs
CREATE POLICY IF NOT EXISTS "fuel_logs_admin_all" ON public.fuel_logs 
FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- Add admin policies for incidents  
CREATE POLICY IF NOT EXISTS "incidents_admin_all" ON public.incidents 
FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- Add admin policies for notes
CREATE POLICY IF NOT EXISTS "notes_admin_all" ON public.notes 
FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- Add storage policy for admins to read odometer photos
CREATE POLICY IF NOT EXISTS "admins_read_odometer_photos" ON storage.objects
FOR SELECT USING (
  bucket_id = 'odometer-photos' 
  AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- Add storage policy for admins to insert odometer photos
CREATE POLICY IF NOT EXISTS "admins_insert_odometer_photos" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'odometer-photos'
  AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- Add storage policy for drivers to insert their own odometer photos
CREATE POLICY IF NOT EXISTS "drivers_insert_own_odometer_photos" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'odometer-photos'
  AND auth.uid() IS NOT NULL
);
