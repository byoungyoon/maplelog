import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { characterListFixture } from "./fixtures/nexon";
let connection: typeof import("@/server/connection");
let database: typeof import("@/server/db");
let crypto: typeof import("@/server/connection/crypto");
beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(
    path.join(tmpdir(), "mesolog-connection-"),
  );
  process.env.CREDENTIAL_ENCRYPTION_KEY = randomBytes(32).toString("hex");
  connection = await import("@/server/connection");
  database = await import("@/server/db");
  crypto = await import("@/server/connection/crypto");
});
beforeEach(() => database.sqlite.prepare("DELETE FROM usage").run());
afterAll(() => database.sqlite.close());
const success: typeof fetch = async () => Response.json(characterListFixture);
describe("실제 키 연결 서비스 (외부 HTTP 응답은 테스트 fixture)", () => {
  it("빈 설치는 미연결이며 운영 샘플이 없다", () => {
    expect(connection.connectionStatus().connected).toBe(false);
    expect(database.readBook("live").characters).toHaveLength(0);
    expect(
      database.sqlite.prepare("SELECT * FROM books WHERE mode=?").get("demo"),
    ).toBeUndefined();
  });
  it("잘못된 키와 스키마 응답은 장부를 열지 않는다", async () => {
    await expect(
      connection.connectKey(
        "test-invalid-key",
        async () => new Response("", { status: 403 }),
      ),
    ).rejects.toThrow("API 키");
    await expect(
      connection.connectKey("test-invalid-schema", async () =>
        Response.json({}),
      ),
    ).rejects.toThrow("계약");
    expect(connection.connectionStatus().connected).toBe(false);
  });
  it("공식 스키마 검증 성공 이후에만 암호화 저장하고 캐릭터를 가져온다", async () => {
    const result = await connection.connectKey("test-only-valid-key", success);
    expect(result.connected).toBe(true);
    expect(JSON.stringify(result)).not.toContain("test-only-valid-key");
    const row = database.sqlite
      .prepare("SELECT encrypted FROM credentials")
      .get() as { encrypted: string };
    expect(row.encrypted).not.toContain("test-only-valid-key");
    expect(crypto.decryptCredential(row.encrypted)).toBe("test-only-valid-key");
    expect(database.readBook("live").characters[0]).toMatchObject({
      id: "test-ocid",
      managed: false,
    });
  });
  it("GCM nonce를 재사용하지 않고 암호문 변조를 거절한다", () => {
    const a = crypto.encryptCredential("test-only"),
      b = crypto.encryptCredential("test-only");
    expect(a).not.toBe(b);
    const parts = a.split(".");
    parts[2] = Buffer.from("tampered").toString("base64");
    expect(() => crypto.decryptCredential(parts.join("."))).toThrow();
  });
  it("늦게 도착한 이전 키 확인은 새 연결을 덮어쓰지 않는다", async () => {
    let finish!: (v: Response) => void;
    const pending = connection.connectKey(
      "test-old-request",
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await connection.connectKey("test-new-request", success);
    finish(Response.json(characterListFixture));
    await expect(pending).rejects.toThrow("최근");
    const row = database.sqlite
      .prepare("SELECT encrypted FROM credentials")
      .get() as { encrypted: string };
    expect(crypto.decryptCredential(row.encrypted)).toBe("test-new-request");
  });
  it("해제 후 진행 중이던 연결 응답이 키를 되살리지 않는다", async () => {
    let finish!: (v: Response) => void;
    const pending = connection.connectKey(
      "test-disconnect-pending",
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    connection.disconnect();
    finish(Response.json(characterListFixture));
    await expect(pending).rejects.toThrow("최근");
    expect(connection.connectionStatus().connected).toBe(false);
    expect(database.readBook("live").characters).toHaveLength(1);
  });
});
