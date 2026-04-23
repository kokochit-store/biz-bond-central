// Password hashing using PBKDF2 (Web Crypto API). Salted + slow to make
// offline brute-force attacks expensive even if the localStorage hash is stolen.
// NOTE: This is a client-side-only app with no backend, so this is hardening,
// not true authentication.

const PBKDF2_ITERATIONS = 200_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');

const fromHex = (hex: string) => {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
};

async function pbkdf2(password: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS },
    key,
    KEY_BITS,
  );
  return toHex(new Uint8Array(bits));
}

export interface PasswordHash {
  algo: 'pbkdf2-sha256';
  iterations: number;
  salt: string; // hex
  hash: string; // hex
}

export async function hashPassword(password: string): Promise<PasswordHash> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await pbkdf2(password, salt);
  return { algo: 'pbkdf2-sha256', iterations: PBKDF2_ITERATIONS, salt: toHex(salt), hash };
}

// Constant-time string comparison to avoid timing leaks.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function verifyPassword(password: string, stored: PasswordHash): Promise<boolean> {
  const computed = await pbkdf2(password, fromHex(stored.salt));
  return timingSafeEqual(computed, stored.hash);
}

// Sentinel default credential — no real hash is shipped. The store treats this
// marker as "default password 'admin'" and will accept that exact password
// once, prompting the user to set a real one.
export const DEFAULT_PASSWORD_SENTINEL: PasswordHash = {
  algo: 'pbkdf2-sha256',
  iterations: 0,
  salt: '',
  hash: '__default__',
};

export const DEFAULT_PASSWORD_PLAINTEXT = 'admin';

export function isDefaultPasswordHash(h: PasswordHash | undefined | null): boolean {
  return !!h && h.iterations === 0 && h.hash === '__default__';
}
