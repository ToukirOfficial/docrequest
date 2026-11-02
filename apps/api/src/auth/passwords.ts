import argon2 from 'argon2';

// argon2id with OWASP-recommended minimums; light enough for a small VPS.
const options = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, options);
}

export function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password).catch(() => false);
}

// Verified against when the email is unknown, so timing doesn't reveal which emails exist.
let dummyHash: Promise<string> | undefined;
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword('not-a-real-password-just-for-timing');
  await verifyPassword(await dummyHash, password);
}
