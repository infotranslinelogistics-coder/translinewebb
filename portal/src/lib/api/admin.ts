import { supabase } from '@/lib/supabase';

type AdminResponse = {
  ok: boolean;
  error?: string;
};

async function getAccessToken(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data?.session?.access_token) {
    throw new Error('Admin session not available. Please sign in again.');
  }
  return data.session.access_token;
}

async function postJson<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const token = await getAccessToken();
  const response = await fetch(path, {
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

export async function forceEndShift(shiftId: string, reason: string): Promise<AdminResponse> {
  return postJson<AdminResponse>('/api/admin/force-end-shift', {
    shift_id: shiftId,
    reason,
  });
}

export async function forceEndBreak(driverId: string): Promise<AdminResponse> {
  return postJson<AdminResponse>('/api/admin/force-end-break', {
    driver_id: driverId,
  });
}

export async function listDriverEmails(userIds: string[]): Promise<Record<string, string | null>> {
  if (userIds.length === 0) return {};
  const result = await postJson<{ emails: Record<string, string | null> }>('/api/admin/list-driver-emails', {
    user_ids: userIds,
  });
  return result.emails;
}
