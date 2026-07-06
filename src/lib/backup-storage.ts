import { Readable, pipeline } from 'stream';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as Minio from 'minio';
import type { BackupStorageConfig } from '@prisma/client';

const pipelineAsync = promisify(pipeline);

export interface BackupAdapter {
  uploadStream(key: string, stream: Readable, contentType?: string): Promise<void>;
  listObjects(prefix: string): Promise<{ key: string; size: number }[]>;
  downloadStream(key: string): Promise<Readable>;
  deleteObject(key: string): Promise<void>;
  testConnection(): Promise<{ ok: boolean; error?: string }>;
}

// ── MinIO Remote / NAS (S3-compatible) ───────────────────────
class MinioRemoteAdapter implements BackupAdapter {
  private client: Minio.Client;
  private bucket: string;

  constructor(config: BackupStorageConfig) {
    this.bucket = config.minioBucket ?? 'lms-backups';
    this.client = new Minio.Client({
      endPoint: config.minioEndpoint ?? 'localhost',
      port: config.minioPort ?? 9000,
      useSSL: config.minioUseSsl,
      accessKey: config.minioAccessKey ?? '',
      secretKey: config.minioSecretKey ?? '',
      region: config.minioRegion ?? undefined,
    });
  }

  async uploadStream(key: string, stream: Readable, contentType = 'application/octet-stream'): Promise<void> {
    await this.client.putObject(this.bucket, key, stream, undefined, { 'Content-Type': contentType });
  }

  async listObjects(prefix: string): Promise<{ key: string; size: number }[]> {
    return new Promise((resolve, reject) => {
      const results: { key: string; size: number }[] = [];
      const stream = this.client.listObjects(this.bucket, prefix, true);
      stream.on('data', (obj) => {
        if (obj.name) results.push({ key: obj.name, size: obj.size ?? 0 });
      });
      stream.on('end', () => resolve(results));
      stream.on('error', reject);
    });
  }

  async downloadStream(key: string): Promise<Readable> {
    return this.client.getObject(this.bucket, key);
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) await this.client.makeBucket(this.bucket, 'us-east-1');
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }
}

// ── Google Cloud Storage ──────────────────────────────────────
class GcsAdapter implements BackupAdapter {
  private storage: import('@google-cloud/storage').Storage | null = null;
  private bucket: string;
  private keyJson: string;
  private projectId: string;

  constructor(config: BackupStorageConfig) {
    this.bucket = config.gcsBucket ?? 'lms-backups';
    this.keyJson = config.gcsKeyJson ?? '';
    this.projectId = config.gcsProjectId ?? '';
  }

  private async getStorage() {
    if (!this.storage) {
      const { Storage } = await import('@google-cloud/storage');
      const credentials = JSON.parse(this.keyJson);
      this.storage = new Storage({ projectId: this.projectId, credentials });
    }
    return this.storage;
  }

  async uploadStream(key: string, stream: Readable, contentType = 'application/octet-stream'): Promise<void> {
    const storage = await this.getStorage();
    const file = storage.bucket(this.bucket).file(key);
    const writeStream = file.createWriteStream({ metadata: { contentType }, resumable: false });
    await new Promise<void>((resolve, reject) => {
      stream.pipe(writeStream).on('finish', resolve).on('error', reject);
    });
  }

  async listObjects(prefix: string): Promise<{ key: string; size: number }[]> {
    const storage = await this.getStorage();
    const [files] = await storage.bucket(this.bucket).getFiles({ prefix });
    return files.map((f) => ({ key: f.name, size: parseInt(String(f.metadata.size ?? 0), 10) }));
  }

  async downloadStream(key: string): Promise<Readable> {
    const storage = await this.getStorage();
    return storage.bucket(this.bucket).file(key).createReadStream();
  }

  async deleteObject(key: string): Promise<void> {
    const storage = await this.getStorage();
    await storage.bucket(this.bucket).file(key).delete();
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      const storage = await this.getStorage();
      const [exists] = await storage.bucket(this.bucket).exists();
      if (!exists) await storage.createBucket(this.bucket);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }
}

// ── Google Drive (Service Account) ───────────────────────────
class GoogleDriveAdapter implements BackupAdapter {
  private drive: import('googleapis').drive_v3.Drive | null = null;
  private folderId: string;
  private keyJson: string;

  constructor(config: BackupStorageConfig) {
    this.folderId = config.gdriveFolderId ?? '';
    this.keyJson = config.gdriveKeyJson ?? '';
  }

  private async getDrive() {
    if (!this.drive) {
      const { google } = await import('googleapis');
      const credentials = JSON.parse(this.keyJson);
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive'],
      });
      this.drive = google.drive({ version: 'v3', auth });
    }
    return this.drive;
  }

  // Google Drive: key = "prefix/filename" — we create folders as needed
  private async ensureFolder(path: string): Promise<string> {
    const drive = await this.getDrive();
    const parts = path.split('/').filter(Boolean);
    let parentId = this.folderId;
    for (const part of parts) {
      const res = await drive.files.list({
        q: `name='${part}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id)',
      });
      if (res.data.files?.length) {
        parentId = res.data.files[0].id!;
      } else {
        const created = await drive.files.create({
          requestBody: { name: part, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
          fields: 'id',
        });
        parentId = created.data.id!;
      }
    }
    return parentId;
  }

  async uploadStream(key: string, stream: Readable, contentType = 'application/octet-stream'): Promise<void> {
    const drive = await this.getDrive();
    const parts = key.split('/');
    const fileName = parts.pop()!;
    const folderPath = parts.join('/');
    const parentId = folderPath ? await this.ensureFolder(folderPath) : this.folderId;
    await drive.files.create({
      requestBody: { name: fileName, parents: [parentId] },
      media: { mimeType: contentType, body: stream },
    });
  }

  async listObjects(prefix: string): Promise<{ key: string; size: number }[]> {
    const drive = await this.getDrive();
    const res = await drive.files.list({
      q: `'${this.folderId}' in parents and trashed=false`,
      fields: 'files(id,name,size)',
    });
    return (res.data.files ?? []).map((f) => ({
      key: `${prefix}${f.name}`,
      size: parseInt(String(f.size ?? 0), 10),
    }));
  }

  async downloadStream(key: string): Promise<Readable> {
    const drive = await this.getDrive();
    const parts = key.split('/');
    const fileName = parts.pop()!;
    const res = await drive.files.list({
      q: `name='${fileName}' and '${this.folderId}' in parents and trashed=false`,
      fields: 'files(id)',
    });
    const fileId = res.data.files?.[0]?.id;
    if (!fileId) throw new Error(`File not found in Drive: ${key}`);
    const dl = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
    return dl.data as unknown as Readable;
  }

  async deleteObject(key: string): Promise<void> {
    const drive = await this.getDrive();
    const parts = key.split('/');
    const fileName = parts.pop()!;
    const res = await drive.files.list({
      q: `name='${fileName}' and '${this.folderId}' in parents and trashed=false`,
      fields: 'files(id)',
    });
    const fileId = res.data.files?.[0]?.id;
    if (fileId) await drive.files.delete({ fileId });
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      const drive = await this.getDrive();
      await drive.files.get({ fileId: this.folderId, fields: 'id,name' });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }
}

// ── Local Disk ────────────────────────────────────────────────
class LocalAdapter implements BackupAdapter {
  private basePath: string;

  constructor(config: BackupStorageConfig) {
    this.basePath = config.localPath ?? path.join(process.cwd(), 'backups');
  }

  private resolve(key: string): string {
    return path.join(this.basePath, ...key.split('/'));
  }

  async uploadStream(key: string, stream: Readable): Promise<void> {
    const dest = this.resolve(key);
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    const writeStream = fs.createWriteStream(dest);
    await pipelineAsync(stream, writeStream);
  }

  async listObjects(prefix: string): Promise<{ key: string; size: number }[]> {
    const dir = this.resolve(prefix);
    const results: { key: string; size: number }[] = [];
    const walk = async (d: string): Promise<void> => {
      let entries: fs.Dirent[];
      try { entries = await fs.promises.readdir(d, { withFileTypes: true }); }
      catch { return; }
      for (const e of entries) {
        const full = path.join(d, e.name);
        if (e.isDirectory()) {
          await walk(full);
        } else {
          const stat = await fs.promises.stat(full);
          const rel = path.relative(this.basePath, full).replace(/\\/g, '/');
          results.push({ key: rel, size: stat.size });
        }
      }
    };
    await walk(dir);
    return results;
  }

  async downloadStream(key: string): Promise<Readable> {
    return fs.createReadStream(this.resolve(key));
  }

  async deleteObject(key: string): Promise<void> {
    try { await fs.promises.unlink(this.resolve(key)); } catch { /* ignore */ }
  }

  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      await fs.promises.mkdir(this.basePath, { recursive: true });
      await fs.promises.access(this.basePath, fs.constants.W_OK);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }
}

// ── Factory ───────────────────────────────────────────────────
export function createBackupAdapter(config: BackupStorageConfig): BackupAdapter {
  switch (config.destination) {
    case 'LOCAL':        return new LocalAdapter(config);
    case 'MINIO_REMOTE': return new MinioRemoteAdapter(config);
    case 'GCS':          return new GcsAdapter(config);
    case 'GOOGLE_DRIVE': return new GoogleDriveAdapter(config);
    default:             throw new Error(`Unknown backup destination: ${config.destination}`);
  }
}
