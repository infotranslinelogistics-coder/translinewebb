import { getSignedStorageUrl } from '@/lib/storage/privateFiles';

const BUCKET = 'odometer_photos';
const cache = new Map<string, { url: string | null; error: string | null; expiresAt: number }>();

interface OdometerPhotoParams {
  photoPath?: string | null;
  expiresInSeconds?: number;
}

export function clearOdometerPhotoCache(photoPath?: string | null) {
  if (photoPath) {
    cache.delete(photoPath);
  }
}

export async function getOdometerPhotoUrl({
  photoPath,
  expiresInSeconds = 600,
}: OdometerPhotoParams) {
  if (!photoPath) {
    return { url: null, error: null };
  }

  const normalizedPath = photoPath.trim();
  const key = normalizedPath;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return { url: cached.url, error: cached.error };
  }

  const signed = await getSignedStorageUrl({
    filePath: normalizedPath,
    bucket: BUCKET,
    bucketCandidates: [BUCKET, 'odometer-photos', 'uploads'],
    expiresInSeconds,
  });

  if (!signed.url) {
    const message = signed.error ?? 'Unable to load photo';
    cache.set(key, { url: null, error: message, expiresAt: Date.now() + 60 * 1000 });
    console.error('Failed to create signed URL', message);
    return { url: null, error: message };
  }

  const signedUrl = signed.url;
  cache.set(key, { url: signedUrl, error: null, expiresAt: Date.now() + expiresInSeconds * 1000 });
  return { url: signedUrl, error: null };
}
