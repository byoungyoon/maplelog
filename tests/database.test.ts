import { beforeAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { seed } from "./fixtures/ledger";

let database: typeof import("@/server/db");
beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST)
    throw new Error("Firestore emulator is required for database tests");
  database = await import("@/server/db");
  const book = seed("demo");
  await database.bookRef("demo").set({ revision: book.revision, payload: JSON.stringify(book) });
});

describe("Firestore storage, conflicts, and request budgets", () => {
  it("T02 only one tab can apply the same revision", async () => {
    const book = await database.readBook("demo");
    const command = { type: "complete" as const, planId: "c1-b3" };
    const updated = await database.mutate("demo", book.revision, randomUUID(), command);
    await expect(database.mutate("demo", book.revision, randomUUID(), command))
      .rejects.toThrow("다른 창");
    expect(updated.completions.length).toBe(book.completions.length + 1);
  });

  it("T08 idempotency keys cannot apply a command twice", async () => {
    const book = await database.readBook("demo");
    const id = randomUUID();
    const command = {
      type: "drop" as const,
      completionId: book.completions[0].id,
      itemId: "i1",
      quantity: 2,
    };
    const first = await database.mutate("demo", book.revision, id, command);
    const repeated = await database.mutate("demo", book.revision, id, command);
    expect(repeated.revision).toBe(first.revision);
    await expect(database.mutate("demo", first.revision, id, { ...command, quantity: 3 }))
      .rejects.toThrow("재전송");
  });

  it("T09 a failed command leaves the ledger unchanged", async () => {
    const book = await database.readBook("demo");
    const drop = book.drops[0];
    await expect(database.mutate("demo", book.revision, randomUUID(), {
      type: "drop-edit",
      id: drop.id,
      tradable: true,
      shared: false,
      share: 1,
      feeBps: 0,
      cost: "0",
      used: 9999,
      note: "invalid",
    })).rejects.toThrow();
    expect(await database.readBook("demo")).toEqual(book);
  });

  it("T19 enforces five requests per second and a rolling 24-hour budget", async () => {
    const provider = `test:${randomUUID()}`;
    const now = Date.now();
    for (let index = 0; index < 5; index++)
      expect(await database.consumeBudget(provider, 6, now)).toBe(true);
    expect(await database.consumeBudget(provider, 6, now)).toBe(false);
    expect(await database.consumeBudget(provider, 6, now + 1001)).toBe(true);
    expect(await database.consumeBudget(provider, 6, now + 2002)).toBe(false);
    const saved = await database.firestore().collection("usage")
      .doc(encodeURIComponent(provider)).get();
    expect(saved.get("times")).toHaveLength(6);
  });

  it("a separate Firestore read sees the committed ledger", async () => {
    const snapshot = await database.bookRef("demo").get();
    expect(database.decodeLedger(snapshot.data())).toEqual(await database.readBook("demo"));
  });
});
