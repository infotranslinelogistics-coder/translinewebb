import Constants from 'expo-constants';
import { supabase } from '../supabase';

// The admin app calls the same Vercel serverless endpoints the web portal uses
// for service-role operations (creating/deleting drivers, resolving auth emails,
// force-ending shifts/breaks). The portal hits these on its own origin; the
// mobile app must be told the deployed origin via EXPO_PUBLIC_API_BASE_URL
// (or app.json extra.API_BASE_URL). When it is not set, the service-role
// features degrade gracefully instead of crashing — everything else in the app
// runs purely against Supabase and needs no base URL.
const rawBase =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  ((Constants.expoConfig?.extra as Record<string, string> | undefined)?.API_BASE_URL ?? '');

export const apiBaseUrl = rawBase.replace(/\/+$/, '');
export const isAdminApiConfigured = Boolean(apiBaseUrl);

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data?.session?.access_token) {
    throw new Error('Admin session not available. Please sign in again.');
  }
  return data.session.access_token;
}

async function postJson<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  if (!apiBaseUrl) {
    throw new Error(
      'Admin API base URL is not configured. Set EXPO_PUBLIC_API_BASE_URL to your deployed portal origin to enable this action.'
    );
  }
  const token = await getAccessToken();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// Resolves auth emails for a batch of driver user_ids. Returns {} when no API
// base URL is configured or the lookup fails, so callers can show phone-only
// without breaking.
export async function listDriverEmails(userIds: string[]): Promise<Record<string, string | null>> {
  if (userIds.length === 0 || !apiBaseUrl) return {};
  try {
    const result = await postJson<{ emails: Record<string, string | null> }>(
      '/api/admin/list-driver-emails',
      { user_ids: userIds }
    );
    return result.emails ?? {};
  } catch (err) {
    console.warn('[adminApi] listDriverEmails failed', err);
    return {};
  }
}

export async function createDriver(payload: {
  email: string;
  password: string;
  full_name: string;
  phone?: string | null;
}): Promise<{ success?: boolean; user_id?: string }> {
  return postJson('/api/admin/create-driver', {
    email: payload.email,
    password: payload.password,
    full_name: payload.full_name,
    name: payload.full_name,
    phone: payload.phone ?? null,
  });
}

export async function deleteDriver(driverId: string): Promise<{ ok?: boolean }> {
  return postJson('/api/admin/delete-driver', { driver_id: driverId });
}

export async function forceEndShiftApi(shiftId: string, reason: string): Promise<{ ok?: boolean }> {
  return postJson('/api/admin/force-end-shift', { shift_id: shiftId, reason });
}

export async function forceEndBreakApi(driverId: string): Promise<{ ok?: boolean }> {
  return postJson('/api/admin/force-end-break', { driver_id: driverId });
}
