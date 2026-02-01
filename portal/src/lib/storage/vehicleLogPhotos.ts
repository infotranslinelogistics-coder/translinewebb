import { supabase } from '@/lib/supabase';

const BUCKET = 'vehicle_log_photos';
const cache = new Map<string, { url: string; expiresAt: number }>();

export async function getVehicleLogPhotoUrl(path: string, expiresInSeconds: number = 60) {
  if (!path) return null;
  const cached = cache.get(path);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url;
  }
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error) {
    console.error('Failed to create signed URL', error);
    return null;
  }
  const signedUrl = data?.signedUrl ?? null;
  if (signedUrl) {
    cache.set(path, { url: signedUrl, expiresAt: Date.now() + expiresInSeconds * 1000 });
  }
  return signedUrl;
}
