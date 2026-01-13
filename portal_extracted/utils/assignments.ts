import { projectId, publicAnonKey } from '../info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-987e9da2`;

export async function fetchDrivers() {
  const resp = await fetch(`${API_BASE}/drivers`, { headers: { Authorization: `Bearer ${publicAnonKey}` } });
  const data = await resp.json();
  return data.drivers || [];
}

export async function fetchVehicles() {
  const resp = await fetch(`${API_BASE}/vehicles`, { headers: { Authorization: `Bearer ${publicAnonKey}` } });
  const data = await resp.json();
  return data.vehicles || [];
}

export async function assignVehicleToDriver(vehicleId: string, driverId: string) {
  return fetch(`${API_BASE}/vehicles/${vehicleId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${publicAnonKey}`,
    },
    body: JSON.stringify({ assigned_driver_id: driverId, assigned_at: new Date().toISOString(), admin_name: 'Admin User' }),
  });
}

export async function unassignVehicle(vehicleId: string) {
  return fetch(`${API_BASE}/vehicles/${vehicleId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${publicAnonKey}`,
    },
    body: JSON.stringify({ assigned_driver_id: null, assigned_at: null, admin_name: 'Admin User' }),
  });
}
