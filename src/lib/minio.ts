import * as Minio from 'minio';

const globalForMinio = globalThis as unknown as {
  minioClient: Minio.Client | undefined;
};

function createMinioClient(): Minio.Client {
  return new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT ?? 'localhost',
    port: parseInt(process.env.MINIO_PORT ?? '9000', 10),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
  });
}

export const minioClient =
  globalForMinio.minioClient ?? createMinioClient();

if (process.env.NODE_ENV !== 'production') globalForMinio.minioClient = minioClient;

/**
 * Rewrite presigned URL host/protocol to the public-facing MinIO address.
 * MinIO generates URLs using its internal endpoint (localhost), but browsers
 * need to reach MinIO via the public hostname. We swap the origin only —
 * the signature and path stay intact (they're not bound to the host string).
 *
 * Set MINIO_PUBLIC_URL=http://your-server:9000 in .env to enable.
 * If not set, the internal URL is returned as-is (works for localhost access).
 */
function rewriteToPublic(internalUrl: string): string {
  const publicUrl = process.env.MINIO_PUBLIC_URL;
  if (!publicUrl) return internalUrl;
  const internal = new URL(internalUrl);
  const pub = new URL(publicUrl);
  internal.protocol = pub.protocol;
  internal.hostname = pub.hostname;
  internal.port = pub.port;
  return internal.toString();
}

export const BUCKET_PRIVATE = process.env.MINIO_BUCKET_PRIVATE ?? 'lms-private';
export const BUCKET_TEMP = process.env.MINIO_BUCKET_TEMP ?? 'lms-temp';
export const SIGNED_URL_TTL = parseInt(process.env.SIGNED_URL_TTL_MINUTES ?? '20', 10) * 60;

// ── Helpers ────────────────────────────────────────────────────

/**
 * Generate a presigned PUT URL for client-side upload to temp bucket.
 * The URL host is rewritten to MINIO_PUBLIC_URL so browsers can reach it.
 */
export async function getPresignedUploadUrl(
  objectName: string,
  ttlSeconds = 15 * 60,
): Promise<string> {
  const url = await minioClient.presignedPutObject(BUCKET_TEMP, objectName, ttlSeconds);
  return rewriteToPublic(url);
}

/**
 * Generate a presigned GET URL for streaming/viewing private asset.
 * The URL host is rewritten to MINIO_PUBLIC_URL so browsers can reach it.
 */
export async function getPresignedDownloadUrl(
  objectName: string,
  ttlSeconds = SIGNED_URL_TTL,
): Promise<string> {
  const url = await minioClient.presignedGetObject(BUCKET_PRIVATE, objectName, ttlSeconds);
  return rewriteToPublic(url);
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
