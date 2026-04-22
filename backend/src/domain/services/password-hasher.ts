import argon2 from "argon2";
import { randomBytes } from "node:crypto";

const ARGON2_OPTIONS: argon2.Options & { raw?: false } = {
  type: argon2.argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
  hashLength: 32,
};

export async function hashPassword(rawPassword: string): Promise<string> {
  if (!rawPassword) throw new Error("Password is required");

  const salt = randomBytes(16);
  return argon2.hash(rawPassword, {
    ...ARGON2_OPTIONS,
    salt,
  });
}

export async function verifyPassword(
  rawPassword: string,
  passwordHash: string,
): Promise<boolean> {
  if (!rawPassword) return false;
  if (!passwordHash) return false;

  return argon2.verify(passwordHash, rawPassword);
}
