import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { env } from '../config/env.js';

/**
 * Where encrypted bytes live (PRD §3, item 23). Callers only ever pass ciphertext.
 * Keys are random, so nothing about the client or file is visible in storage.
 */
export interface FileStore {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

export function newStorageKey(): string {
  const id = randomBytes(16).toString('hex');
  return `files/${id.slice(0, 2)}/${id}.bin`;
}

function assertKey(key: string): void {
  if (!/^(files|exports)\/[0-9a-f]{2}\/[0-9a-f]{32}\.bin$/.test(key))
    throw new Error('Invalid storage key');
}

export function localStore(root: string): FileStore {
  const base = resolve(root);
  const path = (key: string) => {
    assertKey(key);
    return join(base, key);
  };
  return {
    async put(key, data) {
      const p = path(key);
      await mkdir(dirname(p), { recursive: true, mode: 0o700 });
      await writeFile(p, data, { mode: 0o600 });
    },
    get: (key) => readFile(path(key)),
    async remove(key) {
      await rm(path(key), { force: true });
    },
  };
}

/** Any S3-compatible service. Loaded only when STORAGE_DRIVER=s3. */
function s3Store(bucket: string): FileStore {
  const client = import('@aws-sdk/client-s3').then((m) => ({
    m,
    s3: new m.S3Client({
      region: env.S3_REGION,
      ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT, forcePathStyle: true } : {}),
    }),
  }));
  return {
    async put(key, data) {
      assertKey(key);
      const { m, s3 } = await client;
      await s3.send(
        new m.PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: data,
          ContentType: 'application/octet-stream',
        }),
      );
    },
    async get(key) {
      assertKey(key);
      const { m, s3 } = await client;
      const out = await s3.send(new m.GetObjectCommand({ Bucket: bucket, Key: key }));
      if (!out.Body) throw new Error('Empty object');
      return Buffer.from(await out.Body.transformToByteArray());
    },
    async remove(key) {
      assertKey(key);
      const { m, s3 } = await client;
      await s3.send(new m.DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}

let store: FileStore | undefined;
export function fileStore(): FileStore {
  store ??=
    env.STORAGE_DRIVER === 's3' ? s3Store(env.S3_BUCKET ?? '') : localStore(env.STORAGE_DIR);
  return store;
}
