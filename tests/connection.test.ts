import { beforeAll, beforeEach, describe, it, expect, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { characterListFixture } from "./fixtures/nexon";
import { emptyLedger } from "@/domain/empty-ledger";

let connection: typeof import("@/server/connection");
let database: typeof import("@/server/db");
let crypto: typeof import("@/server/connection/crypto");
beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST)
    throw new Error("Firestore emulator is required for connection tests");
  process.env.CREDENTIAL_ENCRYPTION_KEY = randomBytes(32).toString("hex");
  database = await import("@/server/db");
  connection = await import("@/server/connection");
  crypto = await import("@/server/connection/crypto");
  const book = emptyLedger();
  await database.bookRef("live").set({ revision: book.revision, payload: JSON.stringify(book) });
  await database.credentialRef().delete();
  await database.connectionLockRef().set({ generation: 0 });
});
const success: typeof fetch = async () => Response.json(characterListFixture);
beforeEach(async () => {
  await database.firestore().recursiveDelete(database.firestore().collection("usage"));
});

describe("verified key connection with Firestore persistence", () => {
  it("an empty installation is disconnected", async () => {
    expect((await connection.connectionStatus()).connected).toBe(false);
    expect((await database.readBook("live")).characters).toHaveLength(0);
  });

  it("invalid keys and schemas do not open the ledger", async () => {
    await expect(connection.connectKey(
      "test-invalid-key", async () => new Response("", { status: 403 }),
    )).rejects.toThrow("API 키");
    await expect(connection.connectKey("test-invalid-schema", async () =>
      Response.json({}),
    )).rejects.toThrow("계약");
    expect((await connection.connectionStatus()).connected).toBe(false);
  });

  it("stores only an encrypted key after official schema verification", async () => {
    const result = await connection.connectKey("test-only-valid-key", success);
    expect(result.connected).toBe(true);
    expect(JSON.stringify(result)).not.toContain("test-only-valid-key");
    const encrypted = (await database.credentialRef().get()).get("encrypted") as string;
    expect(encrypted).not.toContain("test-only-valid-key");
    expect(crypto.decryptCredential(encrypted)).toBe("test-only-valid-key");
    expect((await database.readBook("live")).characters[0]).toMatchObject({
      id: "test-ocid", managed: false,
    });
    expect((await database.readBook("live")).settings.setupDone).toBe(true);
  });

  it("uses a fresh GCM nonce and rejects tampered ciphertext", () => {
    const first = crypto.encryptCredential("test-only");
    const second = crypto.encryptCredential("test-only");
    expect(first).not.toBe(second);
    const parts = first.split(".");
    parts[2] = Buffer.from("tampered").toString("base64");
    expect(() => crypto.decryptCredential(parts.join("."))).toThrow();
  });

  it("a late older connection cannot replace a newer one", async () => {
    let finish!: (value: Response) => void;
    const pending = connection.connectKey("test-old-request", () =>
      new Promise((resolve) => { finish = resolve; }));
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    await connection.connectKey("test-new-request", success);
    finish(Response.json(characterListFixture));
    await expect(pending).rejects.toThrow("최근");
    const encrypted = (await database.credentialRef().get()).get("encrypted") as string;
    expect(crypto.decryptCredential(encrypted)).toBe("test-new-request");
  });

  it("disconnect prevents an in-flight connection from restoring a key", async () => {
    let finish!: (value: Response) => void;
    const pending = connection.connectKey("test-disconnect-pending", () =>
      new Promise((resolve) => { finish = resolve; }));
    await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    await connection.disconnect();
    finish(Response.json(characterListFixture));
    await expect(pending).rejects.toThrow("최근");
    expect((await connection.connectionStatus()).connected).toBe(false);
    expect((await database.readBook("live")).characters).toHaveLength(1);
  });
});
