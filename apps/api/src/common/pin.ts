import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';

// scrypt 는 CPU 집약적이라 동기(scryptSync)로 쓰면 이벤트 루프를 수십 ms 블로킹한다.
// 콜백 비동기 버전을 Promise 로 감싸 libuv 스레드풀에서 처리(루프 비블로킹).
function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    scryptCb(password, salt, keylen, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

const KEY_LEN = 24;

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(8);
  const derived = await scryptAsync(pin, salt, KEY_LEN);
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
  const candidate = await scryptAsync(pin, salt, expected.length);
  return (
    candidate.length === expected.length && timingSafeEqual(candidate, expected)
  );
}

export const PIN_PATTERN = /^\d{4}$/;
