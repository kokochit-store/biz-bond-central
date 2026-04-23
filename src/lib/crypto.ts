// SHA-256 hashing using Web Crypto API. Used to avoid storing the admin
// password as plaintext in localStorage. NOTE: This is a client-side-only
// app with no backend, so this is hardening, not true authentication.
export async function sha256(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Stable hash of the legacy default password 'admin' so we can detect first-run
// state without ever embedding the plaintext in storage.
export const DEFAULT_ADMIN_PASSWORD_HASH =
  '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918';
