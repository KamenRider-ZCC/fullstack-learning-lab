import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(nodeScrypt);
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const key = await deriveKey(password, salt, KEY_LENGTH);
  return `scrypt:${salt}:${key.toString('hex')}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, salt, storedHex] = encoded.split(':');
  if (algorithm !== 'scrypt' || !salt || !storedHex) return false;

  const storedKey = Buffer.from(storedHex, 'hex');
  if (storedKey.length === 0) return false;

  const suppliedKey = await deriveKey(password, salt, storedKey.length);
  return timingSafeEqual(storedKey, suppliedKey);
}

async function deriveKey(password: string, salt: string, length: number) {
  return await scrypt(password, salt, length) as Buffer;
}
