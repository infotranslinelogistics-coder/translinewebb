-- Migration: Add location_logs table for GPS tracking

-- Create location_logs table
CREATE TABLE IF NOT EXISTS public.location_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_id uuid REFERENCES public.shifts(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  latitude numeric(10, 8) NOT NULL,
  longitude numeric(11, 8) NOT NULL,
  accuracy numeric(10, 2),
  speed numeric(10, 2),
  heading numeric(5, 2),
  timestamp timestamptz NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_location_logs_driver_id ON public.location_logs(driver_id);
CREATE INDEX IF NOT EXISTS idx_location_logs_shift_id ON public.location_logs(shift_id);
CREATE INDEX IF NOT EXISTS idx_location_logs_timestamp ON public.location_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_location_logs_created_at ON public.location_logs(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.location_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to SELECT their own location logs
CREATE POLICY IF NOT EXISTS "Users can view own location logs" ON public.location_logs
FOR SELECT USING (
  auth.uid() = driver_id
);

-- Allow admins to SELECT all location logs
CREATE POLICY IF NOT EXISTS "Admins can view all location logs" ON public.location_logs
FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- Allow drivers to INSERT their own location logs
CREATE POLICY IF NOT EXISTS "Drivers can insert own location logs" ON public.location_logs
FOR INSERT WITH CHECK (
  auth.uid() = driver_id
);

-- Allow admins to INSERT location logs
CREATE POLICY IF NOT EXISTS "Admins can insert location logs" ON public.location_logs
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- Enable realtime for location_logs table
ALTER PUBLICATION supabase_realtime ADD TABLE public.location_logs;
