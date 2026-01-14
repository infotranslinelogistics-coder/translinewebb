export type DriverStatus = 'moving' | 'slow' | 'warning' | 'critical' | 'offline';

export interface LocationLog {
  id: string;
  shift_id: string;
  driver_id: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  timestamp: string;
  created_at: string;
}

export interface Driver {
  id: string;
  full_name: string;
  email: string;
  vehicle?: {
    registration: string;
    type: string;
  };
  shift?: {
    id: string;
    started_at: string;
  };
  locations: LocationLog[];
  status: DriverStatus;
}
