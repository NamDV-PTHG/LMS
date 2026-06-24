import * as Minio from 'minio';

const globalForMinio = globalThis as unknown as {
  minioClient: Minio.Client | undefined;
  minioPresignClient: Minio.Client | undefined;
};

/** Internal client — used for all object operations (get, put, delete, stat). */
function createMinioClient(): Minio.Client {
  return new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT ?? 'localhost',
    port: parseInt(process.env.MINIO_PORT ?? '9000', 10),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
  });
}

/**
 * Public client — used ONLY for generating presigned URLs.
 *
 * AWS4 presigned URLs include the Host in the signature scope. If the URL is
 * generated with the internal host (localhost) but served to browsers via a
 * public host, the Host header won't match → 403 SignatureDoesNotMatch.
 *
 * Fix: sign presigned URLs using the public endpoint so the Host in the
 * signature matches the Host the browser sends.
 *
 * Set MINIO_PUBLIC_URL=http://lms.example.com:9000 in .env.
 * Falls back to the internal client if MINIO_PUBLIC_URL is not set.
 */
function createMinioPresignClient(): Minio.Client {
  const publicUrl = process.env.MINIO_PUBLIC_URL;
  if (!publicUrl) return createMinioClient();

  const u = new URL(publicUrl);
  const port = u.port ? parseInt(u.port, 10) : (u.protocol === 'https:' ? 443 : 80);
  return new Minio.Client({
    endPoint: u.hostname,
    port,
    useSSL: u.protocol === 'https:',
    accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
  });
}

export const minioClient =
  globalForMinio.minioClient ?? createMinioClient();

const minioPresignClient =
  globalForMinio.minioPresignClient ?? createMinioPresignClient();

if (process.env.NODE_ENV !== 'production') {
  globalForMinio.minioClient = minioClient;
  globalForMinio.minioPresignClient = minioPresignClient;
}

export const BUCKET_PRIVATE = process.env.MINIO_BUCKET_PRIVATE ?? 'lms-private';
export const BUCKET_TEMP = process.env.MINIO_BUCKET_TEMP ?? 'lms-temp';
export const SIGNED_URL_TTL = parseInt(process.env.SIGNED_URL_TTL_MINUTES ?? '20', 10) * 60;

// ── Helpers ────────────────────────────────────────────────────

/**
 * Generate a presigned PUT URL for client-side upload to temp bucket.
 * Uses the public MinIO endpoint so the signed Host matches what browsers send.
 */
export async function getPresignedUploadUrl(
  objectName: string,
  ttlSeconds = 15 * 60,
): Promise<string> {
  return minioPresignClient.presignedPutObject(BUCKET_TEMP, objectName, ttlSeconds);
}

/**
 * Generate a presigned GET URL for streaming/viewing private asset.
 * Uses the public MinIO endpoint so the signed Host matches what browsers send.
 */
export async function getPresignedDownloadUrl(
  objectName: string,
  ttlSeconds = SIGNED_URL_TTL,
): Promise<string> {
  return minioPresignClient.presignedGetObject(BUCKET_PRIVATE, objectName, ttlSeconds);
}

/**
 * Move object from temp bucket to private bucket
 */
export async function moveToPrivate(
  sourceObject: string,
  destObject: string,
): Promise<void> {
  const conditions = new Minio.CopyConditions();
  await minioClient.copyObject(
    BUCKET_PRIVATE,
    destObject,
    `/${BUCKET_TEMP}/${sourceObject}`,
    conditions,
  );
  await minioClient.removeObject(BUCKET_TEMP, sourceObject);
}

/**
 * Delete object from private bucket
 */
export async function deletePrivateObject(objectName: string): Promise<void> {
  await minioClient.removeObject(BUCKET_PRIVATE, objectName);
}

/**
 * Read object content as a UTF-8 string (for text files like HLS manifests).
 */
export async function getObjectContent(objectName: string, bucket = BUCKET_PRIVATE): Promise<string> {
  const stream = await minioClient.getObject(bucket, objectName);
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    stream.on('error', reject);
  });
}

/**
 * Ensure required buckets exist
 */
export async function ensureBuckets(): Promise<void> {
  for (const bucket of [BUCKET_PRIVATE, BUCKET_TEMP]) {
    const exists = await minioClient.bucketExists(bucket);
    if (!exists) {
      await minioClient.makeBucket(bucket, 'us-east-1');
      console.log(`[MinIO] Created bucket: ${bucket}`);
    }
  }
}
