import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { seed } from "./fixtures/ledger";
let database: typeof import("@/server/db");
let dir: string;
beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "mesolog-test-"));
  process.env.DATA_DIR = dir;
  database = await import("@/server/db");
  database.sqlite
    .prepare("INSERT INTO books(mode,revision,payload) VALUES(?,?,?)")
    .run("demo", 0, JSON.stringify(seed("demo")));
});
afterAll(() => {
  database.sqlite.close();
});
describe("SQLite 저장·충돌·호출 예산", () => {
  it("T02 두 탭의 동일 revision은 한 번만 변경 가능", () => {
    const s = database.readBook("demo");
    const command = { type: "complete" as const, planId: "c1-b3" };
    const updated = database.mutate("demo", s.revision, randomUUID(), command);
    expect(() =>
      database.mutate("demo", s.revision, randomUUID(), command),
    ).toThrow("다른 창");
    expect(updated.completions.length).toBe(s.completions.length + 1);
  });
  it("T08 같은 idempotency key는 중복 적용하지 않는다", () => {
    const s = database.readBook("demo");
    const id = randomUUID();
    const command = {
      type: "drop" as const,
      completionId: s.completions[0].id,
      itemId: "i1",
      quantity: 2,
    };
    const a = database.mutate("demo", s.revision, id, command);
    const b = database.mutate("demo", s.revision, id, command);
    expect(b.revision).toBe(a.revision);
    expect(() =>
      database.mutate("demo", a.revision, id, { ...command, quantity: 3 }),
    ).toThrow("재전송");
  });
  it("T09 실패한 변경은 트랜잭션 전체를 되돌린다", () => {
    const s = database.readBook("demo");
    const drop = s.drops[0];
    expect(() =>
      database.mutate("demo", s.revision, randomUUID(), {
        type: "drop-edit",
        id: drop.id,
        tradable: true,
        shared: false,
        share: 1,
        feeBps: 0,
        cost: "0",
        used: 9999,
        note: "invalid",
      }),
    ).toThrow();
    expect(database.readBook("demo")).toEqual(s);
  });
  it("T19 5rps와 롤링 24h 예산을 디스크에 보존한다", () => {
    const now = Date.now();
    for (let i = 0; i < 5; i++)
      expect(database.consumeBudget("test", 6, now)).toBe(true);
    expect(database.consumeBudget("test", 6, now)).toBe(false);
    expect(database.consumeBudget("test", 6, now + 1001)).toBe(true);
    expect(database.consumeBudget("test", 6, now + 2002)).toBe(false);
    const second = new Database(path.join(dir, "mesolog.sqlite"));
    expect(
      (
        second
          .prepare("SELECT count(*) n FROM usage WHERE provider=?")
          .get("test") as { n: number }
      ).n,
    ).toBe(6);
    second.close();
  });
  it("서버 재시작에 독립된 DB 연결로 기록을 읽을 수 있다", () => {
    const second = new Database(path.join(dir, "mesolog.sqlite"));
    const row = second
      .prepare("SELECT payload FROM books WHERE mode=?")
      .get("demo") as { payload: string };
    expect(JSON.parse(row.payload)).toEqual(database.readBook("demo"));
    second.close();
  });
});
