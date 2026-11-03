import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM. Stored as "v1.<iv>.<tag>.<ciphertext>", each part base64.
const VERSION = "v1";

export interface Cipher {
  encrypt(plain: string): string;
  decrypt(stored: string): string;
}

export function createCipher(key: Buffer): Cipher {
  if (key.length !== 32) throw new Error("Encryption key must be 32 bytes");
  return {
    encrypt(plain) {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
      return [VERSION, iv, cipher.getAuthTag(), data].map((p) => (typeof p === "string" ? p : p.toString("base64"))).join(".");
    },
    decrypt(stored) {
      const [version, iv, tag, data] = stored.split(".");
      if (version !== VERSION || !iv || !tag || data === undefined) throw new Error("Unknown ciphertext format");
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
      decipher.setAuthTag(Buffer.from(tag, "base64"));
      return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
    },
  };
}
