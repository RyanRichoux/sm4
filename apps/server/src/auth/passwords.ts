import { hash, verify } from "@node-rs/argon2";

// Argon2id (the library default) with OWASP-recommended cost settings.
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

/** Used for unknown emails so a failed login takes the same time either way. */
let dummyHash: Promise<string> | undefined;
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword("not-a-real-password-just-timing");
  await verifyPassword(await dummyHash, password);
}
