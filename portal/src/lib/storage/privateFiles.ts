import { supabase } from '@/lib/supabase';

const DEFAULT_BUCKET_CANDIDATES = [
  'fuel_receipts',
  'receipts',
  'shift_event_receipts',
  'event_receipts',
  'uploads',
  'odometer_photos',
];

const cache = new Map<string, { url: string | null; error: string | null; expiresAt: number }>();

type SignedFileOptions = {
  filePath?: string | null;
  bucket?: string | null;
  bucketCandidates?: string[];
  expiresInSeconds?: number;
};

type BucketPathPair = {
  bucket: string;
  path: string;
};

function normalizePath(filePath: string) {
  return filePath.replace(/^\/+/, '').trim();
}

function looksLikeRemoteUrl(filePath: string) {
  return /^https?:\/\//i.test(filePath);
}

function getBucketCandidates({
  filePath,
  bucket,
  bucketCandidates,
}: {
  filePath: string;
  bucket?: string | null;
  bucketCandidates?: string[];
}): BucketPathPair[] {
  const normalized = normalizePath(filePath);
  const candidates: BucketPathPair[] = [];

  if (bucket) {
    candidates.push({ bucket, path: normalized });
  }

  const slashIndex = normalized.indexOf('/');
  if (slashIndex > 0) {
    candidates.push({
      bucket: normalized.slice(0, slashIndex),
      path: normalized.slice(slashIndex + 1),
    });
  }

  for (const candidateBucket of bucketCandidates ?? DEFAULT_BUCKET_CANDIDATES) {
    candidates.push({ bucket: candidateBucket, path: normalized });
  }

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (!candidate.bucket || !candidate.path) return false;
    const key = `${candidate.bucket}:${candidate.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function getSignedStorageUrl({
  filePath,
  bucket,
  bucketCandidates,
  expiresInSeconds = 600,
}: SignedFileOptions) {
  if (!filePath) {
    return { url: null, error: null };
  }

  if (looksLikeRemoteUrl(filePath)) {
    return { url: filePath, error: null };
  }

  const cacheKey = `${bucket ?? 'auto'}:${filePath}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { url: cached.url, error: cached.error };
  }

  const candidates = getBucketCandidates({ filePath, bucket, bucketCandidates });
  let lastError = 'Unable to load file';

  for (const candidate of candidates) {
    const { data, error } = await supabase.storage
      .from(candidate.bucket)
      .createSignedUrl(candidate.path, expiresInSeconds);

    if (!error && data?.signedUrl) {
      cache.set(cacheKey, {
        url: data.signedUrl,
        error: null,
        expiresAt: Date.now() + expiresInSeconds * 1000,
      });
      return { url: data.signedUrl, error: null };
    }

    if (error?.message) {
      lastError = error.message;
    }
  }

  cache.set(cacheKey, {
    url: null,
    error: lastError,
    expiresAt: Date.now() + 60 * 1000,
  });
  return { url: null, error: lastError };
}