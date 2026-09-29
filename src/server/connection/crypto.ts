import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { ensure } from "@/domain/model";
function masterKey() {
  const value = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (value) {
    ensure(
      /^[a-fA-F0-9]{64}$/.test(value),
      "서버 암호화 키 설정을 확인해 주세요.",
      503,
    );
    return Buffer.from(value, "hex");
  }
  ensure(
    !process.env.APP_ORIGIN,
    "서버의 CREDENTIAL_ENCRYPTION_KEY 설정이 필요해요.",
    503,
  );
  const dir = path.join(process.cwd(), ".local-secrets");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, "credential.key");
  if (!existsSync(file)) {
    try {
      writeFileSync(file, randomBytes(32), { mode: 0o600, flag: "wx" });
    } catch (error) {
      if (!existsSync(file)) throw error;
    }
  }
  const key = readFileSync(file);
  ensure(key.length === 32, "로컬 암호화 키 파일을 확인해 주세요.", 503);
  return key;
}
export function encryptCredential(value: string) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey(), nonce);
  cipher.setAAD(Buffer.from("mesolog:nexon:v1"));
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return [nonce, cipher.getAuthTag(), encrypted]
    .map((x) => x.toString("base64"))
    .join(".");
}
export function decryptCredential(value: string) {
  const [nonce, tag, encrypted] = value
    .split(".")
    .map((x) => Buffer.from(x, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", masterKey(), nonce);
  decipher.setAAD(Buffer.from("mesolog:nexon:v1"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    "utf8",
  );
}
