import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

// No password-hashing dependency exists anywhere in this codebase (no
// bcrypt/argon2) — scrypt is Node's own built-in, so this needs nothing new
// added to package.json. Format: "<saltHex>:<hashHex>", salt regenerated
// per password so two admins with the same password never produce the same
// stored hash.
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(plain, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;
  const derived = (await scryptAsync(plain, salt, KEY_LENGTH)) as Buffer;
  const stored_ = Buffer.from(hashHex, "hex");
  // Both sides must be equal length before timingSafeEqual — a malformed/
  // truncated stored hash would otherwise throw instead of just failing closed.
  if (derived.length !== stored_.length) return false;
  return timingSafeEqual(derived, stored_);
}
