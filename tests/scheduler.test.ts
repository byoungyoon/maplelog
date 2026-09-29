import { beforeAll, beforeEach, afterAll, it, expect, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { emptyLedger } from "@/domain/empty-ledger";
import { validateLedger } from "@/domain/model";
import { applyCommand } from "@/domain/commands";
import { mergeScheduler, type SchedulerData } from "@/server/nexon/normalize";
import { characterListFixture } from "./fixtures/nexon";
let database: typeof import("@/server/db");
let connection: typeof import("@/server/connection");
let sync: typeof import("@/server/nexon/sync");
const sample = (
  complete = true,
  date = "2026-09-29T00:00+09:00",
): SchedulerData => ({
  date,
  boss_contents: [
    {
      content_name: "테스트 보스",
      difficulty: "hard",
      cycle: "bossWeekly",
      list_order_no: 1,
      registration_flag: "true",
      complete_flag: complete ? "true" : "false",
    },
  ],
  weekly_boss_clear_count: complete ? 1 : 0,
  weekly_boss_clear_limit_count: 12,
});
function fresh() {
  const book = emptyLedger();
  book.characters = [
    {
      id: "test-ocid",
      name: "테스트",
      world: "테스트",
      job: "테스트",
      level: 280,
      managed: true,
      favorite: false,
      order: 0,
      avatar: 0,
    },
  ];
  return book;
}
beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "mesolog-scheduler-"));
  process.env.CREDENTIAL_ENCRYPTION_KEY = randomBytes(32).toString("hex");
  database = await import("@/server/db");
  connection = await import("@/server/connection");
  sync = await import("@/server/nexon/sync");
});
beforeEach(() => {
  database.sqlite.prepare("DELETE FROM usage").run();
  database.sqlite.prepare("DELETE FROM leases").run();
  database.writeBook(fresh());
});
afterAll(() => database.sqlite.close());
it("동일 API 완료 10회에도 최초 기록 하나만 생성하고 가격은 미정으로 둔다", () => {
  const b = fresh();
  for (let i = 0; i < 10; i++)
    mergeScheduler(b, "test-ocid", sample(), "2026-09-29T08:00:00.000Z");
  expect(b.completions).toHaveLength(1);
  expect(b.completions[0]).toMatchObject({
    provenance: "initial",
    crystal: null,
    party: null,
    occurredAt: null,
    detectedAt: "2026-09-29T08:00:00.000Z",
    difficulty: "하드",
  });
  expect(b.audit).toHaveLength(0);
  validateLedger(b);
});
it("여러 난이도의 동시 완료는 공유 그룹 한 건과 충돌 상태로 보관한다", () => {
  const b = fresh();
  const s = sample();
  s.boss_contents.push({ ...s.boss_contents[0], difficulty: "normal" });
  mergeScheduler(b, "test-ocid", s);
  expect(b.completions).toHaveLength(1);
  expect(b.completions[0]).toMatchObject({
    status: "conflict",
    difficulty: null,
    crystal: null,
  });
  validateLedger(b);
});
it("일시적 미완료·빈 응답은 완료·드랍을 삭제하지 않고 반복 충돌 알림을 만들지 않는다", () => {
  const b = fresh();
  mergeScheduler(b, "test-ocid", sample());
  for (let i = 0; i < 3; i++) mergeScheduler(b, "test-ocid", sample(false));
  expect(b.completions).toHaveLength(1);
  expect(b.completions[0].status).toBe("conflict");
  expect(b.audit).toHaveLength(1);
  mergeScheduler(b, "test-ocid", { ...sample(), boss_contents: [] });
  expect(b.completions).toHaveLength(1);
  expect(b.sync.characters?.[0].status).toBe("empty");
});
it("목요일 경계를 응답 날짜로 구분하고 오래된 응답이 현재 상태를 덮지 않는다", () => {
  const b = fresh();
  mergeScheduler(b, "test-ocid", sample(true, "2026-09-30T00:00+09:00"));
  mergeScheduler(b, "test-ocid", sample(true, "2026-10-01T00:00+09:00"));
  mergeScheduler(b, "test-ocid", sample(false, "2026-09-29T00:00+09:00"));
  expect(b.completions).toHaveLength(2);
  expect(new Set(b.completions.map((c) => c.periodStart)).size).toBe(2);
  expect(b.completions.every((c) => c.status === "complete")).toBe(true);
  validateLedger(b);
});
it("미지원 주기는 확인 필요로 남기고 수익을 만들지 않는다", () => {
  const b = fresh();
  const s = sample();
  s.boss_contents[0].cycle = "unknown";
  mergeScheduler(b, "test-ocid", s);
  expect(b.completions).toHaveLength(0);
  expect(b.sync.characters?.[0].status).toBe("unsupported");
});
it("사용자 드랍 후보·수량·부분 정산과 기준가가 실제 장부에서 동작한다", () => {
  const b = fresh();
  mergeScheduler(b, "test-ocid", sample());
  const boss = b.bosses[0],
    c = b.completions[0];
  applyCommand(b, {
    type: "item-create",
    bossId: boss.id,
    name: "직접 등록 아이템",
    price: "100000000",
    market: "내 월드",
    variant: "기본",
    tradable: true,
  });
  applyCommand(b, {
    type: "drop",
    completionId: c.id,
    itemId: b.items[0].id,
    quantity: 3,
  });
  applyCommand(b, {
    type: "settle",
    targetId: b.drops[0].id,
    kind: "drop",
    quantity: 1,
    net: "90000000",
    settledAt: "2026-09-29T08:00:00.000Z",
  });
  applyCommand(b, {
    type: "crystal-price",
    bossId: boss.id,
    price: "120000000",
  });
  expect(c.crystal).toBeNull();
  applyCommand(b, {
    type: "completion-confirm",
    id: c.id,
    party: 2,
    difficulty: "하드",
  });
  expect(c.crystal).toBe("60000000");
  expect(b.settlements).toHaveLength(1);
  validateLedger(b);
});
it("동시 동기화 요청은 외부 요청 한 번으로 합쳐진다", async () => {
  await connection.connectKey("test-sync-key", async () =>
    Response.json(characterListFixture),
  );
  const b = database.readBook("live");
  b.characters[0].managed = true;
  b.characters[0].imageUpdatedAt = new Date().toISOString();
  database.writeBook(b);
  let finish!: (r: Response) => void;
  const fetcher = vi.fn(() => new Promise<Response>((r) => (finish = r)));
  const pending = sync.syncAccount({ fetcher });
  const second = await sync.syncAccount({ fetcher });
  expect(second.coalesced).toBe(true);
  finish(Response.json(sample()));
  expect((await pending).success).toBe(1);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(database.readBook("live").completions).toHaveLength(1);
});
it("부분 실패는 정상 캐릭터 결과를 보존하고 캐릭터별 오류를 남긴다", async () => {
  await connection.connectKey("test-partial-key", async () =>
    Response.json(characterListFixture),
  );
  const b = fresh();
  b.characters.push({ ...b.characters[0], id: "second-ocid" });
  b.characters.forEach((c) => (c.imageUpdatedAt = new Date().toISOString()));
  database.writeBook(b);
  const fetcher: typeof fetch = async (url) =>
    String(url).includes("second-ocid")
      ? new Response("", { status: 503 })
      : Response.json(sample());
  const result = await sync.syncAccount({ fetcher });
  expect(result).toMatchObject({ success: 1, failed: 1 });
  expect(database.readBook("live").completions).toHaveLength(1);
  expect(
    database.readBook("live").sync.characters?.map((c) => c.status),
  ).toEqual(["ok", "error"]);
});
it("연결 해제 후 도착한 API 결과는 저장되지 않는다", async () => {
  await connection.connectKey("test-disconnect-sync", async () =>
    Response.json(characterListFixture),
  );
  const b = database.readBook("live");
  b.characters[0].managed = true;
  database.writeBook(b);
  let finish!: (r: Response) => void;
  const pending = sync.syncAccount({
    fetcher: () => new Promise<Response>((r) => (finish = r)),
  });
  connection.disconnect();
  finish(Response.json(sample()));
  await expect(pending).rejects.toThrow("키 연결");
  expect(database.readBook("live").completions).toHaveLength(0);
});
it("429 Retry-After는 재요청을 차단하고 장부를 지우지 않는다", async () => {
  await connection.connectKey("test-limited-key", async () =>
    Response.json(characterListFixture),
  );
  const b = fresh();
  mergeScheduler(b, "test-ocid", sample());
  database.writeBook(b);
  const fetcher = vi.fn(
    async () =>
      new Response("", { status: 429, headers: { "Retry-After": "120" } }),
  );
  expect((await sync.syncAccount({ fetcher })).failed).toBe(1);
  database.sqlite
    .prepare("DELETE FROM leases WHERE name='scheduler-sync'")
    .run();
  expect((await sync.syncAccount({ fetcher })).failed).toBe(1);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(database.readBook("live").completions).toHaveLength(1);
});
