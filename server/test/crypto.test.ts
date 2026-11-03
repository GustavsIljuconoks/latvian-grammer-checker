import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createCipher } from "../src/crypto";

describe("cipher", () => {
  const cipher = createCipher(randomBytes(32));

  it("round-trips Latvian text", () => {
    const text = "Ķēniņš ēda šķiņķi ar žāvētām plūmēm. 🙂";
    expect(cipher.decrypt(cipher.encrypt(text))).toBe(text);
    expect(cipher.decrypt(cipher.encrypt(""))).toBe("");
  });

  it("does not store the plain text and uses a fresh IV each time", () => {
    const a = cipher.encrypt("slepens");
    expect(a).not.toContain("slepens");
    expect(cipher.encrypt("slepens")).not.toBe(a);
  });

  it("rejects tampered data and the wrong key", () => {
    const stored = cipher.encrypt("teksts");
    const [v, iv, tag, data] = stored.split(".");
    const flipped = Buffer.from(data, "base64");
    flipped[0] ^= 1;
    expect(() => cipher.decrypt([v, iv, tag, flipped.toString("base64")].join("."))).toThrow();
    expect(() => createCipher(randomBytes(32)).decrypt(stored)).toThrow();
  });

  it("requires a 32-byte key", () => {
    expect(() => createCipher(randomBytes(16))).toThrow();
  });
});
