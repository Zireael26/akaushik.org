/**
 * Password KDF used by both the product app and the owner bootstrap CLI.
 *
 * OWASP-listed scrypt tuple (N=16384, r=8, p=5) via the node:crypto scrypt
 * primitive with constant-time compare. This module has NO Next.js imports
 * so the CLI can use the identical qualified primitive. Disposition recorded
 * in the private auth qualification report (see README.md).
 */
import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";

/** OWASP-listed scrypt work factor, qualified on workerd (see REPORT.md). */
export const PASSWORD_KDF = { N: 16384, r: 8, p: 5, dkLen: 64 } as const;

function scryptKey(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize("NFKC"),
      salt,
      PASSWORD_KDF.dkLen,
      {
        N: PASSWORD_KDF.N,
        r: PASSWORD_KDF.r,
        p: PASSWORD_KDF.p,
        maxmem: 128 * PASSWORD_KDF.N * PASSWORD_KDF.r * 2,
      },
      (err, key) => (err ? reject(err) : resolve(key as Buffer)),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${(await scryptKey(password, salt)).toString("hex")}`;
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    const [salt, key] = hash.split(":");
    if (!salt || !key) return false;
    const a = await scryptKey(password, salt);
    const b = Buffer.from(key, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
