import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';

/**
 * Envelope encryption (PRD §3, item 16).
 * Each file gets a fresh random 256-bit key and is encrypted with AES-256-GCM.
 * That file key is then "wrapped" (encrypted) by a master key: from MASTER_KEY
 * in the environment, or by AWS KMS. Only the wrapped key is stored.
 */
export interface Sealed {
  ciphertext: Buffer;
  iv: string;
  authTag: string;
  wrappedKey: string;
}

interface KeyWrapper {
  wrap(fileKey: Buffer): Promise<string>;
  unwrap(wrapped: string): Promise<Buffer>;
}

/** Wraps file keys with AES-256-GCM under MASTER_KEY. Format: "env:v1:" + base64(iv|tag|ciphertext). */
export function envWrapper(masterKeyB64: string): KeyWrapper {
  const master = Buffer.from(masterKeyB64, 'base64');
  if (master.length !== 32) throw new Error('MASTER_KEY must be 32 bytes');
  return {
    async wrap(fileKey) {
      const iv = randomBytes(12);
      const c = createCipheriv('aes-256-gcm', master, iv);
      const ct = Buffer.concat([c.update(fileKey), c.final()]);
      return `env:v1:${Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64')}`;
    },
    async unwrap(wrapped) {
      if (!wrapped.startsWith('env:v1:')) throw new Error('Unknown key format');
      const raw = Buffer.from(wrapped.slice(7), 'base64');
      const d = createDecipheriv('aes-256-gcm', master, raw.subarray(0, 12));
      d.setAuthTag(raw.subarray(12, 28));
      return Buffer.concat([d.update(raw.subarray(28)), d.final()]);
    },
  };
}

/** Wraps file keys with AWS KMS. Loaded only when KEY_DRIVER=kms. Format: "kms:" + base64(blob). */
function kmsWrapper(keyId: string): KeyWrapper {
  const client = import('@aws-sdk/client-kms').then((m) => ({ m, kms: new m.KMSClient({}) }));
  return {
    async wrap(fileKey) {
      const { m, kms } = await client;
      const out = await kms.send(new m.EncryptCommand({ KeyId: keyId, Plaintext: fileKey }));
      if (!out.CiphertextBlob) throw new Error('KMS returned no ciphertext');
      return `kms:${Buffer.from(out.CiphertextBlob).toString('base64')}`;
    },
    async unwrap(wrapped) {
      if (!wrapped.startsWith('kms:')) throw new Error('Unknown key format');
      const { m, kms } = await client;
      const out = await kms.send(
        new m.DecryptCommand({
          KeyId: keyId,
          CiphertextBlob: Buffer.from(wrapped.slice(4), 'base64'),
        }),
      );
      if (!out.Plaintext) throw new Error('KMS returned no plaintext');
      return Buffer.from(out.Plaintext);
    },
  };
}

let wrapper: KeyWrapper | undefined;
function defaultWrapper(): KeyWrapper {
  wrapper ??=
    env.KEY_DRIVER === 'kms' ? kmsWrapper(env.KMS_KEY_ID ?? '') : envWrapper(env.MASTER_KEY ?? '');
  return wrapper;
}

export async function seal(plain: Buffer, w: KeyWrapper = defaultWrapper()): Promise<Sealed> {
  const fileKey = randomBytes(32);
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', fileKey, iv);
  const ciphertext = Buffer.concat([c.update(plain), c.final()]);
  const sealed = {
    ciphertext,
    iv: iv.toString('base64'),
    authTag: c.getAuthTag().toString('base64'),
    wrappedKey: await w.wrap(fileKey),
  };
  fileKey.fill(0);
  return sealed;
}

/** Throws if the key, IV, tag or bytes are wrong or have been tampered with. */
export async function unseal(s: Sealed, w: KeyWrapper = defaultWrapper()): Promise<Buffer> {
  const fileKey = await w.unwrap(s.wrappedKey);
  try {
    const d = createDecipheriv('aes-256-gcm', fileKey, Buffer.from(s.iv, 'base64'));
    d.setAuthTag(Buffer.from(s.authTag, 'base64'));
    return Buffer.concat([d.update(s.ciphertext), d.final()]);
  } finally {
    fileKey.fill(0);
  }
}
