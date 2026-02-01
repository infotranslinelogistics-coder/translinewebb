-- Migration: Vehicle logs, driver stops, and odometer location enrichment

-- Fuel logs
CREATE TABLE IF NOT EXISTS public.fuel_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  shift_id uuid REFERENCES public.shifts(id) ON DELETE SET NULL,
  liters numeric,
  cost numeric,
  fuel_type text,
  station_name text,
  station_address text,
  lat double precision,
  lng double precision,
  receipt_photo_path text,
  noted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_fuel_logs_vehicle_noted ON public.fuel_logs(vehicle_id, noted_at DESC);
CREATE INDEX IF NOT EXISTS idx_fuel_logs_driver_noted ON public.fuel_logs(driver_id, noted_at DESC);

ALTER TABLE public.fuel_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS fuel_logs_admin_all ON public.fuel_logs
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY IF NOT EXISTS fuel_logs_driver_insert ON public.fuel_logs
  FOR INSERT WITH CHECK (auth.uid() = driver_id);

CREATE POLICY IF NOT EXISTS fuel_logs_driver_select ON public.fuel_logs
  FOR SELECT USING (auth.uid() = driver_id);

-- Maintenance logs
CREATE TABLE IF NOT EXISTS public.maintenance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES public.drivers(id) ON DELETE SET NULL,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  shift_id uuid REFERENCES public.shifts(id) ON DELETE SET NULL,
  category text NOT NULL,
  title text NOT NULL,
  description text,
  cost numeric,
  odometer_value integer,
  vendor_name text,
  vendor_address text,
  lat double precision,
  lng double precision,
  photo_path text,
  noted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_maintenance_logs_vehicle_noted ON public.maintenance_logs(vehicle_id, noted_at DESC);
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_driver_noted ON public.maintenance_logs(driver_id, noted_at DESC);

ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS maintenance_logs_admin_all ON public.maintenance_logs
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY IF NOT EXISTS maintenance_logs_driver_insert ON public.maintenance_logs
  FOR INSERT WITH CHECK (auth.uid() = driver_id);

CREATE POLICY IF NOT EXISTS maintenance_logs_driver_select ON public.maintenance_logs
  FOR SELECT USING (auth.uid() = driver_id);

-- Storage bucket for vehicle log photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('vehicle_log_photos', 'vehicle_log_photos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY IF NOT EXISTS vehicle_log_photos_admin_read ON storage.objects
  FOR SELECT USING (
    bucket_id = 'vehicle_log_photos'
    AND public.is_admin()
  );

CREATE POLICY IF NOT EXISTS vehicle_log_photos_admin_write ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'vehicle_log_photos'
    AND public.is_admin()
  );

CREATE POLICY IF NOT EXISTS vehicle_log_photos_driver_write ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'vehicle_log_photos'
    AND auth.uid() IS NOT NULL
  );

-- Enrich odometer logs with optional location
ALTER TABLE public.odometer_logs
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision,
  ADD COLUMN IF NOT EXISTS accuracy_m double precision;

-- Driver stops table
CREATE TABLE IF NOT EXISTS public.driver_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  shift_id uuid REFERENCES public.shifts(id) ON DELETE SET NULL,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  duration_seconds integer NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  radius_m numeric,
  source text NOT NULL DEFAULT 'computed',
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_driver_stops_driver_start ON public.driver_stops(driver_id, start_at DESC);

ALTER TABLE public.driver_stops ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS driver_stops_admin_all ON public.driver_stops
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY IF NOT EXISTS driver_stops_driver_select ON public.driver_stops
  FOR SELECT USING (auth.uid() = driver_id);

-- Helper for distance calculation
CREATE OR REPLACE FUNCTION public.haversine_m(
  lat1 double precision,
  lng1 double precision,
  lat2 double precision,
  lng2 double precision
) RETURNS double precision
LANGUAGE sql IMMUTABLE AS $$
  SELECT 6371000 * 2 * asin(
    sqrt(
      power(sin(radians((lat2 - lat1) / 2)), 2)
      + cos(radians(lat1)) * cos(radians(lat2))
      * power(sin(radians((lng2 - lng1) / 2)), 2)
    )
  );
$$;

-- Compute driver stops for a range and store them
CREATE OR REPLACE FUNCTION public.compute_driver_stops(
  driver_id uuid,
  start_ts timestamptz,
  end_ts timestamptz,
  speed_threshold_kmh double precision DEFAULT 2,
  radius_m numeric DEFAULT 50,
  min_duration_seconds integer DEFAULT 120,
  should_store boolean DEFAULT true
) RETURNS SETOF public.driver_stops
LANGUAGE plpgsql AS $$
DECLARE
  loc record;
  current_start timestamptz;
  current_end timestamptz;
  anchor_lat double precision;
  anchor_lng double precision;
  last_lat double precision;
  last_lng double precision;
  current_shift_id uuid;
  current_vehicle_id uuid;
  distance_m double precision;
BEGIN
  IF should_store THEN
    DELETE FROM public.driver_stops
    WHERE driver_stops.driver_id = compute_driver_stops.driver_id
      AND start_at >= start_ts
      AND end_at <= end_ts;
  END IF;

  FOR loc IN
    SELECT *
    FROM public.driver_locations
    WHERE driver_locations.driver_id = compute_driver_stops.driver_id
      AND recorded_at BETWEEN start_ts AND end_ts
    ORDER BY recorded_at
  LOOP
    IF loc.speed_kmh IS NOT NULL AND loc.speed_kmh <= speed_threshold_kmh THEN
      IF current_start IS NULL THEN
        current_start := loc.recorded_at;
        current_end := loc.recorded_at;
        anchor_lat := loc.lat;
        anchor_lng := loc.lng;
        last_lat := loc.lat;
        last_lng := loc.lng;
        current_shift_id := loc.shift_id;
        current_vehicle_id := loc.vehicle_id;
      ELSE
        distance_m := public.haversine_m(anchor_lat, anchor_lng, loc.lat, loc.lng);
        IF distance_m <= radius_m THEN
          current_end := loc.recorded_at;
          last_lat := loc.lat;
          last_lng := loc.lng;
        ELSE
          IF current_end IS NOT NULL
            AND extract(epoch FROM current_end - current_start) >= min_duration_seconds THEN
            IF should_store THEN
              INSERT INTO public.driver_stops (
                driver_id,
                shift_id,
                vehicle_id,
                start_at,
                end_at,
                duration_seconds,
                lat,
                lng,
                radius_m,
                source
              ) VALUES (
                compute_driver_stops.driver_id,
                current_shift_id,
                current_vehicle_id,
                current_start,
                current_end,
                extract(epoch FROM current_end - current_start)::integer,
                anchor_lat,
                anchor_lng,
                radius_m,
                'computed'
              );
            END IF;
          END IF;
          current_start := loc.recorded_at;
          current_end := loc.recorded_at;
          anchor_lat := loc.lat;
          anchor_lng := loc.lng;
          last_lat := loc.lat;
          last_lng := loc.lng;
          current_shift_id := loc.shift_id;
          current_vehicle_id := loc.vehicle_id;
        END IF;
      END IF;
    ELSE
      IF current_start IS NOT NULL
        AND current_end IS NOT NULL
        AND extract(epoch FROM current_end - current_start) >= min_duration_seconds THEN
        IF should_store THEN
          INSERT INTO public.driver_stops (
            driver_id,
            shift_id,
            vehicle_id,
            start_at,
            end_at,
            duration_seconds,
            lat,
            lng,
            radius_m,
            source
          ) VALUES (
            compute_driver_stops.driver_id,
            current_shift_id,
            current_vehicle_id,
            current_start,
            current_end,
            extract(epoch FROM current_end - current_start)::integer,
            anchor_lat,
            anchor_lng,
            radius_m,
            'computed'
          );
        END IF;
      END IF;
      current_start := NULL;
      current_end := NULL;
    END IF;
  END LOOP;

  IF current_start IS NOT NULL
    AND current_end IS NOT NULL
    AND extract(epoch FROM current_end - current_start) >= min_duration_seconds THEN
    IF should_store THEN
      INSERT INTO public.driver_stops (
        driver_id,
        shift_id,
        vehicle_id,
        start_at,
        end_at,
        duration_seconds,
        lat,
        lng,
        radius_m,
        source
      ) VALUES (
        compute_driver_stops.driver_id,
        current_shift_id,
        current_vehicle_id,
        current_start,
        current_end,
        extract(epoch FROM current_end - current_start)::integer,
        anchor_lat,
        anchor_lng,
        radius_m,
        'computed'
      );
    END IF;
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.driver_stops
  WHERE driver_stops.driver_id = compute_driver_stops.driver_id
    AND start_at >= start_ts
    AND end_at <= end_ts
  ORDER BY start_at;
END;
$$;
