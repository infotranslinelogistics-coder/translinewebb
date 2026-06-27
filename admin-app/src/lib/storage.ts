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
