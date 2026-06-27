import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

// scrypt 는 CPU 집약적이라 동기(scryptSync)로 쓰면 이벤트 루프를 수십 ms 블로킹한다.
// 비동기 버전은 libuv 스레드풀에서 돌아 루프를 막지 않는다.
const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LEN = 24;

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(8);
  const derived = await scrypt(pin, salt, KEY_LEN);
  return `${salt.toString('hex')}:${derived.toString('hex')}`;
}

export async function verifyPin(
  pin: string,
  stored: string | null,
): Promise<boolean> {
  if (!stored) return false;
  const [saltHex, derivedHex] = stored.split(':');
  if (!saltHex || !derivedHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(derivedHex, 'hex');
  const candidate = await scrypt(pin, salt, expected.length);
  return (
    candidate.length === expected.length && timingSafeEqual(candidate, expected)
  );
}

export const PIN_PATTERN = /^\d{4}$/;
