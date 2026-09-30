import { describe, it, expect } from "vitest";
import { seed } from "./fixtures/ledger";
import { applyCommand, observe } from "@/domain/commands";
import { validateLedger } from "@/domain/model";
import { bossEarnings, entries, summarize } from "@/domain/revenue";
import { estimate, formatMeso, csvCell } from "@/domain/money";
import { periodAt } from "@/domain/period";
import { report } from "@/server/report";
const NOW = "2026-09-29T05:32:00.000Z";
const setup = () => seed("demo", NOW);
const row = (s: ReturnType<typeof setup>, id: string) =>
  entries(s).find((e) => e.id === id)!;
describe("수익 계산과 정산 수명주기", () => {
  it("T13 예상 1억을 순수령 9천만으로 대체한다", () => {
    const s = setup();
    applyCommand(s, {
      type: "settle",
      targetId: "d3",
      kind: "drop",
      quantity: 1,
      net: "90000000",
      settledAt: NOW,
    });
    expect(row(s, "d3").total).toBe("90000000");
    expect(row(s, "d3").expected).toBe("0");
  });
  it("T14 3개 중 1개 정산 시 남은 2개의 예상만 더한다", () => {
    const s = setup();
    expect(row(s, "d1")).toMatchObject({
      quantity: 3,
      remaining: 2,
      actual: "50000000",
      expected: "110000000",
      total: "160000000",
    });
  });
  it("T15 정산 수정과 취소가 정확히 복구된다", () => {
    const s = setup();
    applyCommand(s, {
      type: "settle",
      targetId: "d1",
      kind: "drop",
      quantity: 2,
      net: "90000000",
      settledAt: NOW,
      settlementId: "s1",
    });
    expect(row(s, "d1").total).toBe("145000000");
    applyCommand(s, { type: "cancel-settlement", id: "s1" });
    expect(row(s, "d1")).toMatchObject({
      remaining: 3,
      actual: "0",
      expected: "165000000",
    });
  });
  it("T11 미정과 0을 구분한다", () => {
    const s = setup();
    expect(row(s, "d2").unknown).toBe(true);
    expect(row(s, "d2").expected).toBeNull();
    expect(formatMeso(null)).toBe("가격 확인 필요");
    expect(formatMeso("0")).toBe("0");
    expect(summarize(entries(s)).unknown).toBe(1);
  });
  it("T12 거래 불가와 사용 수량은 판매 예상에서 제외한다", () => {
    const s = setup();
    s.drops.find((d) => d.id === "d3")!.tradable = false;
    expect(row(s, "d3").expected).toBe("0");
    s.drops.find((d) => d.id === "d1")!.used = 1;
    expect(row(s, "d1").expected).toBe("55000000");
    validateLedger(s);
  });
  it("T16 가격표 수정은 기존 스냅샷·정산을 바꾸지 않는다", () => {
    const s = setup();
    const before = structuredClone(s.drops);
    applyCommand(
      s,
      {
        type: "price",
        id: "i1",
        price: "999999999",
        market: "데모 시장",
        variant: "기본 · 교환 가능",
      },
      NOW,
    );
    expect(s.drops).toEqual(before);
    expect(row(s, "d1").total).toBe("160000000");
  });
  it("T18 개인 보상과 공동 보상을 구분하고 정수로 내림한다", () => {
    expect(estimate("100", 3, 333, "2", 2)).toBe(144n);
    expect(estimate("100", 3, 0, "0", 1)).toBe(300n);
    const s = setup();
    const d = s.drops.find((d) => d.id === "d3")!;
    d.shared = true;
    d.share = 3;
    expect(row(s, "d3").expected).toBe("33333333");
    d.shared = false;
    expect(row(s, "d3").expected).toBe("100000000");
  });
  it("T24 MAX_SAFE_INTEGER를 넘는 값과 반올림 경계", () => {
    const n = "90071992547409931234567890";
    expect(estimate(n, 3, 0, "0", 1)).toBe(BigInt(n) * 3n);
    expect(formatMeso(n, true).replaceAll(",", "")).toBe(n);
    expect(estimate("101", 1, 100, "0", 3)).toBe(33n);
  });
  it("T26 조건 미정을 솔로로 간주하지 않는다", () => {
    const s = setup();
    const c = observe(s, "c1-b6", NOW)!;
    expect(c.crystal).toBeNull();
    expect(c.difficulty).toBeNull();
    expect(row(s, c.id).unknown).toBe(true);
  });
  it("정산·사용 수량보다 작은 목표 수량과 초과 정산은 거절한다", () => {
    const s = setup();
    const d = s.drops[0];
    expect(() =>
      applyCommand(s, {
        type: "drop",
        completionId: d.completionId,
        itemId: d.itemId,
        quantity: 0,
      }),
    ).toThrow();
    expect(() =>
      applyCommand(s, {
        type: "settle",
        targetId: "d1",
        kind: "drop",
        quantity: 3,
        net: "1",
        settledAt: NOW,
      }),
    ).toThrow();
  });
});
describe("완료 관측과 드랍", () => {
  it("T01 동일 응답 10회에도 완료·결정석은 1개", () => {
    const s = setup();
    for (let i = 0; i < 10; i++) observe(s, "c1-b3", NOW);
    expect(
      s.completions.filter((c) => c.characterId === "c1" && c.bossId === "b3"),
    ).toHaveLength(1);
    expect(s.audit.filter((a) => a.title === "완료 감지")).toHaveLength(1);
  });
  it("T03 같은 clearGroup 난이도는 하나의 후보만 만든다", () => {
    const s = setup();
    s.bosses.push({ ...s.bosses[0], id: "alternate", difficulty: "노멀" });
    s.plans.push({ ...s.plans[0], id: "alternate-plan", bossId: "alternate" });
    const n = s.completions.length;
    observe(s, "alternate-plan", NOW);
    expect(s.completions).toHaveLength(n);
  });
  it("T04 최초 완료는 새 처치 알림을 만들지 않는다", () => {
    const s = setup();
    const n = s.audit.length;
    const c = observe(s, "c2-b1", NOW, true, true)!;
    expect(c.provenance).toBe("initial");
    expect(c.occurredAt).toBeNull();
    expect(s.audit).toHaveLength(n);
  });
  it("T05 오류에 정상 기록은 유지된다", () => {
    const s = setup();
    const before = JSON.stringify(s.completions);
    applyCommand(s, { type: "sync", scenario: "error" }, NOW);
    expect(JSON.stringify(s.completions)).toBe(before);
    expect(s.sync.lastSuccess).toBe(NOW);
    expect(s.sync.error).toContain("오류");
  });
  it("T06 회귀 응답은 장부를 삭제하지 않고 충돌 표시한다", () => {
    const s = setup();
    const n = s.completions.length;
    observe(s, "c1-b1", NOW, false);
    expect(s.completions).toHaveLength(n);
    expect(s.completions[0].status).toBe("conflict");
  });
  it("T07 KST 주간 경계와 지연 응답을 분리한다", () => {
    const before = "2026-09-30T14:59:59.999Z",
      after = "2026-09-30T15:00:00.000Z";
    expect(periodAt(before, "weekly").end).toBe(after);
    expect(periodAt(after, "weekly").start).toBe(after);
    const s = setup();
    observe(s, "c1-b1", after);
    observe(s, "c1-b1", before);
    expect(
      s.completions.filter((c) => c.characterId === "c1" && c.bossId === "b1"),
    ).toHaveLength(2);
  });
  it("일간·월간 KST 경계", () => {
    expect(periodAt("2026-09-30T15:00:00Z", "monthly").start).toBe(
      "2026-09-30T15:00:00.000Z",
    );
    expect(periodAt("2026-09-30T15:00:00Z", "daily").start).toBe(
      "2026-09-30T15:00:00.000Z",
    );
  });
  it("T08 목표 수량 재전송은 획득을 누적하지 않는다", () => {
    const s = setup();
    for (let n = 0; n < 10; n++)
      applyCommand(s, {
        type: "drop",
        completionId: s.completions[0].id,
        itemId: "i1",
        quantity: 3,
      });
    expect(
      s.drops.filter((d) => d.completionId === s.completions[0].id),
    ).toHaveLength(1);
    expect(
      s.drops.find((d) => d.completionId === s.completions[0].id)!.quantity,
    ).toBe(3);
  });
  it("T10 아무 수정 없이는 미입력을 없음으로 바꾸지 않는다", () => {
    const s = setup();
    expect(s.completions[0].review).toBe("pending");
    entries(s);
    expect(s.completions[0].review).toBe("pending");
  });
  it("드랍 없음은 선택 삭제 확인이 필요하다", () => {
    const s = setup();
    const c = s.completions[2];
    expect(() =>
      applyCommand(s, { type: "review", id: c.id, value: "none" }),
    ).toThrow();
    applyCommand(s, { type: "review", id: c.id, value: "none", confirm: true });
    expect(c.review).toBe("none");
  });
  it("수동 제외는 재조회에서도 유지된다", () => {
    const s = setup();
    const c = s.completions[0];
    applyCommand(s, { type: "exclude", id: c.id, value: true });
    observe(s, "c1-b1", NOW);
    expect(c.excluded).toBe(true);
  });
  it("수동 기록과 API 관측을 하나로 연결한다", () => {
    const s = setup();
    const c = observe(s, "c1-b3", NOW, true, false, true)!;
    observe(s, "c1-b3", NOW);
    expect(s.completions.filter((x) => x.id === c.id)).toHaveLength(1);
    expect(s.audit.some((x) => x.title === "완료 기록 연결")).toBe(true);
  });
});
describe("백업·기간 보고서", () => {
  it("과거 정산 이력은 보스 완료 보고서에 별도 정산 상태로 노출하지 않는다", () => {
    const s = setup();
    applyCommand(s, {
      type: "settle",
      targetId: "d3",
      kind: "drop",
      quantity: 1,
      net: "90000000",
      settledAt: "2026-10-20T00:00:00.000Z",
    });
    expect(row(s, "d3").total).toBe("90000000");
    const r = report(s, new URL("http://local/?cycle=weekly"));
    expect(r).not.toHaveProperty("cash");
    expect(r).not.toHaveProperty("cashSummary");
  });
  it("T22 운영 seed에는 데모 캐릭터와 수익이 없다", () => {
    const s = seed("live", NOW);
    expect(s.characters).toHaveLength(0);
    expect(entries(s)).toHaveLength(0);
  });
  it("T23 백업 참조·중복·과다 정산·금액 형식을 검사한다", () => {
    const s = setup();
    expect(validateLedger(JSON.parse(JSON.stringify(s)))).toEqual(s);
    const duplicate = setup();
    duplicate.completions.push({ ...duplicate.completions[0], id: "new" });
    expect(() => validateLedger(duplicate)).toThrow();
    const invalid = setup();
    invalid.drops[0].completionId = "missing";
    expect(() => validateLedger(invalid)).toThrow();
    expect(() => validateLedger({ ...s, revision: NaN })).toThrow();
  });
  it("CSV 수식 및 따옴표 이스케이프", () => {
    expect(csvCell('=IMPORTDATA("bad")')).toBe('"\'=IMPORTDATA(""bad"")"');
    expect(csvCell(" +1")).toBe('"\' +1"');
  });
});

describe("재평가와 조건 보정", () => {
  it("부분 정산 이후 재평가는 당시 스냅샷·실제 정산을 유지한다", () => {
    const s = setup();
    const original = structuredClone(s.drops[0]);
    applyCommand(s, {
      type: "price",
      id: "i1",
      price: "100000000",
      market: original.market,
      variant: original.variant,
    });
    applyCommand(s, { type: "revalue", id: "d1" });
    expect(s.drops[0].unitPrice).toBe(original.unitPrice);
    expect(row(s, "d1")).toMatchObject({
      actual: "50000000",
      expected: "200000000",
      total: "250000000",
    });
  });
  it("미정 분배는 사용자 보정 후 계산된다", () => {
    const s = setup();
    s.plans.find((p) => p.id === "c1-b3")!.party = null;
    const c = observe(s, "c1-b3", NOW)!;
    expect(c.crystal).toBeNull();
    applyCommand(s, {
      type: "completion-confirm",
      id: c.id,
      party: 2,
      difficulty: "하드",
    });
    expect(c.crystal).toBe("9000000");
    expect(c.party).toBe(2);
  });
  it("운영 모드로 라벨만 바꾼 데모 백업을 거절한다", () => {
    const s = setup();
    s.mode = "live";
    expect(() => validateLedger(s)).toThrow("데모 규칙");
  });
});

it("3월 말에서 이전 월 조회는 2월이며 월말을 넘기지 않는다", () => {
  const s = setup();
  const r = report(
    s,
    new URL("http://local/?cycle=monthly&offset=-1"),
    new Date("2026-03-31T12:00:00Z"),
  );
  expect(r.period.start).toBe("2026-01-31T15:00:00.000Z");
  expect(r.period.end).toBe("2026-02-28T15:00:00.000Z");
});

it("정산 보고서는 캐릭터 쿼리와 관계없이 전체를 합산한다", () => {
  const s = setup();
  const now = new Date(NOW);
  expect(report(s, new URL("http://local/?character=c1"), now)).toEqual(
    report(s, new URL("http://local/"), now),
  );
});

it("보스 카드는 완료 캐릭터 수와 획득 기준 수익만 합산한다", () => {
  const s = setup();
  const second = observe(s, "c2-b1", NOW)!;
  let group = bossEarnings(s, s.completions).find(
    (item) => item.group === "g1",
  )!;
  expect(group.characterCount).toBe(2);
  expect(group.total).toBe("56000000");
  applyCommand(s, {
    type: "settle",
    targetId: second.id,
    kind: "crystal",
    quantity: 1,
    net: "25000000",
    settledAt: NOW,
  });
  group = bossEarnings(s, s.completions).find((item) => item.group === "g1")!;
  expect(group.total).toBe("56000000");
  second.excluded = true;
  group = bossEarnings(s, s.completions).find((item) => item.group === "g1")!;
  expect(group.characterCount).toBe(1);
  expect(group.total).toBe("28000000");
});

it("완료 기록이 제외되어도 다른 캐릭터의 남은 보스 예상액을 보여준다", () => {
  const s = setup();
  s.characters.forEach((character) => (character.managed = false));
  s.completions = [];
  s.drops = [];
  s.settlements = [];
  observe(s, "c1-b1", NOW)!.excluded = true;
  const result = report(
    s,
    new URL("http://local/?cycle=weekly"),
    new Date(NOW),
  );
  expect(result.summary.total).toBe("0");
  expect(result.remaining).toBe(11);
  expect(result.remainingKnownAmount).toBe("236000000");
  expect(result.projectedTotal).toBe("236000000");
});
