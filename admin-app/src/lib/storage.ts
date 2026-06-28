import { supabase } from './supabase';

const DEFAULT_BUCKET_CANDIDATES = [
  'fuel_receipts',
  'driver_log_photos',
  'odometer_photos',
  'receipts',
  'shift_event_receipts',
  'event_receipts',
];

const cache = new Map<string, { url: string | null; expiresAt: number }>();

function normalizePath(filePath: string) {
  return filePath.replace(/^\/+/, '').trim();
}

function looksLikeRemoteUrl(filePath: string) {
  return /^https?:\/\//i.test(filePath);
}

export async function getSignedStorageUrl({
  filePath,
  bucket,
  bucketCandidates,
  expiresInSeconds = 3600,
}: {
  filePath: string | null;
  bucket?: string | null;
  bucketCandidates?: string[];
  expiresInSeconds?: number;
}): Promise<string | null> {
  if (!filePath) return null;
  if (looksLikeRemoteUrl(filePath)) return filePath;

  const cacheKey = `${bucket ?? 'auto'}:${filePath}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const normalized = normalizePath(filePath);
  const candidates = bucket
    ? [bucket]
    : bucketCandidates ?? DEFAULT_BUCKET_CANDIDATES;

  for (const candidateBucket of candidates) {
    const { data, error } = await supabase.storage
      .from(candidateBucket)
      .createSignedUrl(normalized, expiresInSeconds);

    if (!error && data?.signedUrl) {
      cache.set(cacheKey, { url: data.signedUrl, expiresAt: Date.now() + expiresInSeconds * 1000 });
      return data.signedUrl;
    }
  }

  cache.set(cacheKey, { url: null, expiresAt: Date.now() + 60 * 1000 });
  return null;
}

// ─── Odometer photos ──────────────────────────────────────────────────────
// Mirrors the portal's getOdometerPhotoUrl: a dedicated cache + {url,error}
// shape so screens can show a "Photo failed / Retry" state.
const ODOMETER_BUCKET = 'odometer_photos';
const odometerCache = new Map<string, { url: string | null; error: string | null; expiresAt: number }>();

export function clearOdometerPhotoCache(photoPath?: string | null) {
  if (photoPath) odometerCache.delete(photoPath.trim());
}

export async function getOdometerPhotoUrl({
  photoPath,
  expiresInSeconds = 600,
}: {
  photoPath?: string | null;
  expiresInSeconds?: number;
}): Promise<{ url: string | null; error: string | null }> {
  if (!photoPath) return { url: null, error: null };

  const key = photoPath.trim();
  const cached = odometerCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return { url: cached.url, error: cached.error };
  }

  // Pass candidates (not a single bucket) so getSignedStorageUrl tries each.
  const url = await getSignedStorageUrl({
    filePath: key,
    bucketCandidates: [ODOMETER_BUCKET, 'odometer-photos', 'uploads'],
    expiresInSeconds,
  });

  if (!url) {
    const message = 'Unable to load photo';
    odometerCache.set(key, { url: null, error: message, expiresAt: Date.now() + 60 * 1000 });
    return { url: null, error: message };
  }

  odometerCache.set(key, { url, error: null, expiresAt: Date.now() + expiresInSeconds * 1000 });
  return { url, error: null };
}
