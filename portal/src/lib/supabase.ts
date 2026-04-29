// Supabase client configuration
import { createClient } from '@supabase/supabase-js';
import { getEnv } from './env';

// Get Supabase credentials from environment variables
const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Type definitions for database tables
export interface Driver {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: 'online' | 'offline';
  last_gps_lat?: number;
  last_gps_lng?: number;
  current_shift_id?: string;
  created_at: string;
}

export interface Vehicle {
  id: string;
  plate_number: string;
  make: string;
  model: string;
  status: 'active' | 'maintenance' | 'inactive';
  last_inspection_date?: string;
  created_at: string;
}

export interface Shift {
  id: string;
  driver_id: string;
  vehicle_id: string | null;
  started_at: string;
  ended_at: string | null;
  status: 'active' | 'ended' | 'cancelled';
  checklist?: Record<string, 'pass' | 'fail' | null> | null;
  driver_name?: string | null;
  vehicle_rego?: string | null;
}

export interface ShiftChecklist {
  id: string;
  shift_id: string;
  start_clean?: boolean;
  start_fuel_level?: number;
  start_odometer?: number;
  start_odometer_photo?: string;
  start_tyre_condition?: string;
  start_damage_notes?: string;
  end_rubbish_removed?: boolean;
  end_new_damage?: boolean;
  end_odometer?: number;
  end_odometer_photo?: string;
  notes?: string;
  created_at: string;
}

export interface VehicleOdometerLog {
  id: string;
  vehicle_id: string;
  driver_id: string;
  odometer_value: number;
  odometer_photo_url?: string;
  recorded_at: string;
  notes?: string;
}

export interface VehicleMaintenance {
  id: string;
  vehicle_id: string;
  last_service_date?: string;
  last_service_odometer?: number;
  next_service_odometer?: number;
  next_service_date?: string;
  service_interval_km?: number;
  service_interval_days?: number;
  status: 'ok' | 'due_soon' | 'overdue';
  notes?: string;
}

export interface MaintenanceLog {
  id: string;
  vehicle_id: string;
  service_type: string;
  service_date: string;
  odometer: number;
  cost?: number;
  provider?: string;
  invoice_url?: string;
  notes?: string;
  created_at: string;
}

export interface DriverLog {
  id: string;
  driver_id: string;
  vehicle_id?: string;
  log_type: 'incident' | 'maintenance_issue' | 'accident' | 'general';
  description: string;
  photo_url?: string;
  created_at: string;
}
