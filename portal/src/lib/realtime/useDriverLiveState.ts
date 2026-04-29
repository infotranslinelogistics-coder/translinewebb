import { useEffect, useState } from 'react';
import { useDriverLocations } from '@/lib/realtime/useDriverLocations';
import { useDriverPresence } from '@/lib/realtime/useDriverPresence';
import type { DriverLocation } from '@/lib/db/locations';

export type DriverLiveStatus = {
  driver_id: string;
  last_seen_at: string | null;
  is_online: boolean | null;
  status_state: string | null;
  on_break: boolean | null;
  status_started_at: string | null;
  last_location_at: string | null;
  lat: number | null;
  lng: number | null;
  speed_kmh: number | null;
  heading: number | null;
  vehicle_id: string | null;
  shift_id: string | null;
};

const ONLINE_WINDOW_MS = 60 * 1000;

export function isOnlineFromLastSeen(lastSeenAt?: string | null) {
  if (!lastSeenAt) return false;
  return new Date(lastSeenAt) > new Date(Date.now() - ONLINE_WINDOW_MS);
}

export function useDriverLiveState() {
  const [statusMap, setStatusMap] = useState<Record<string, DriverLiveStatus>>({});
  const [locationMap, setLocationMap] = useState<Record<string, DriverLocation>>({});

  useDriverPresence(
    (presence) => {
      setStatusMap((prev) => {
        const existing = prev[presence.driver_id] ?? ({
          driver_id: presence.driver_id,
          last_seen_at: null,
          is_online: null,
          status_state: null,
          on_break: null,
          status_started_at: null,
          last_location_at: null,
          lat: null,
          lng: null,
          speed_kmh: null,
          heading: null,
          vehicle_id: null,
          shift_id: null,
        } as DriverLiveStatus);
        return {
          ...prev,
          [presence.driver_id]: {
            ...existing,
            last_seen_at: presence.last_seen_at,
            is_online: isOnlineFromLastSeen(presence.last_seen_at),
          },
        };
      });
    },
    (statusEvent) => {
      setStatusMap((prev) => {
        const existing = prev[statusEvent.driver_id] ?? ({
          driver_id: statusEvent.driver_id,
          last_seen_at: null,
          is_online: null,
          status_state: null,
          on_break: null,
          status_started_at: null,
          last_location_at: null,
          lat: null,
          lng: null,
          speed_kmh: null,
          heading: null,
          vehicle_id: null,
          shift_id: null,
        } as DriverLiveStatus);
        return {
          ...prev,
          [statusEvent.driver_id]: {
            ...existing,
            status_state: statusEvent.state,
            on_break: statusEvent.state === 'break',
            status_started_at: statusEvent.started_at,
          },
        };
      });
    }
  );

  useDriverLocations((newLocation) => {
    setLocationMap((prev) => ({
      ...prev,
      [newLocation.driver_id]: newLocation,
    }));
    setStatusMap((prev) => {
      const existing = prev[newLocation.driver_id] ?? ({
        driver_id: newLocation.driver_id,
        last_seen_at: null,
        is_online: null,
        status_state: null,
        on_break: null,
        status_started_at: null,
        last_location_at: null,
        lat: null,
        lng: null,
        speed_kmh: null,
        heading: null,
        vehicle_id: null,
        shift_id: null,
      } as DriverLiveStatus);
      return {
        ...prev,
        [newLocation.driver_id]: {
          ...existing,
          last_location_at: newLocation.created_at,
          lat: newLocation.latitude,
          lng: newLocation.longitude
        },
      };
    });
  });

  useEffect(() => {
    setStatusMap((prev) => {
      const next: Record<string, DriverLiveStatus> = {};
      Object.entries(prev).forEach(([driverId, status]) => {
        next[driverId] = {
          ...status,
          is_online: isOnlineFromLastSeen(status.last_seen_at),
        };
      });
      return next;
    });
  }, []);

  return { statusMap, setStatusMap, locationMap, setLocationMap };
}
