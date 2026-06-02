import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_LEN = 24;

export function hashPin(pin: string): string {
  const salt = randomBytes(8);
  const derived = scryptSync(pin, salt, KEY_LEN);
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

export function verifyPin(pin: string, stored: string | null): boolean {
  if (!stored) return false;
  const [saltHex, derivedHex] = stored.split(':');
  if (!saltHex || !derivedHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(derivedHex, 'hex');
  const candidate = scryptSync(pin, salt, expected.length);
  return (
    candidate.length === expected.length && timingSafeEqual(candidate, expected)
  );
}

export const PIN_PATTERN = /^\d{4}$/;
