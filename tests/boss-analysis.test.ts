import { beforeAll, beforeEach, afterAll, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import fixture from "./fixtures/boss-analysis.json";
import { characterListFixture } from "./fixtures/nexon";
let connection: typeof import("@/server/connection");
let db: typeof import("@/server/db");
let service: typeof import("@/server/catalog/boss-analysis");
let strength: typeof import("@/server/nexon/strength");
beforeAll(async () => {
  process.env.DATA_DIR = mkdtempSync(
    path.join(tmpdir(), "mesolog-boss-analysis-"),
  );
  process.env.CREDENTIAL_ENCRYPTION_KEY = randomBytes(32).toString("hex");
  connection = await import("@/server/connection");
  db = await import("@/server/db");
  service = await import("@/server/catalog/boss-analysis");
  strength = await import("@/server/nexon/strength");
});
beforeEach(async () => {
  db.sqlite.exec(
    "DELETE FROM leases; DELETE FROM usage; DELETE FROM boss_analyses;",
  );
  await connection.connectKey("test-only-boss-key", async () =>
    Response.json(characterListFixture),
  );
});
afterAll(() => db.sqlite.close());
const fetcher: typeof fetch = async (input, init) => {
  const url = String(input);
  expect(JSON.stringify(init)).not.toContain("test-only-boss-key");
  if (url.endsWith("/ko/result"))
    return new Response(
      '<script src="/_next/static/chunks/8153-abc123.js"></script>',
    );
  if (url.includes("8153-"))
    return new Response('"api-key":"00000000-0000-0000-0000-000000000000"');
  expect(url).toContain("https://api.maplescouter.com/api/id?");
  expect(url).toContain("preset=00000");
  return Response.json(fixture);
};
it("fetches an owned character and serves a versioned cache without further requests", async () => {
  const first = await service.analyzeCharacter("test-ocid", fetcher);
  const second = await service.analyzeCharacter("test-ocid", async () => {
    throw Error("must use cache");
  });
  expect(first.cuts).toHaveLength(47);
  expect(second).toEqual(first);
  expect(db.readBook("live").completions).toHaveLength(0);
});
it("does not request unrelated characters", async () => {
  await expect(
    service.analyzeCharacter("not-owned", async () => {
      throw Error("unexpected request");
    }),
  ).rejects.toThrow("연결된 캐릭터");
});
it("rejects stale in-flight results after a key disconnect", async () => {
  await expect(
    service.analyzeCharacter("test-ocid", async (input, init) => {
      if (String(input).includes("/api/id?")) {
        connection.disconnect();
        return Response.json(fixture);
      }
      return fetcher(input, init);
    }),
  ).rejects.toThrow("키 연결이 변경");
  expect(db.sqlite.prepare("SELECT * FROM boss_analyses").all()).toHaveLength(
    0,
  );
});
it("does not cache malformed results and observes the cooldown", async () => {
  await expect(
    service.analyzeCharacter("test-ocid", async (input, init) =>
      String(input).includes("/api/id?")
        ? Response.json({})
        : fetcher(input, init),
    ),
  ).rejects.toThrow("계산 형식");
  await expect(service.analyzeCharacter("test-ocid", fetcher)).rejects.toThrow(
    "잠시",
  );
  expect(db.sqlite.prepare("SELECT * FROM boss_analyses").all()).toHaveLength(
    0,
  );
});
it("stores verified combat power once per day", async () => {
  const first = await strength.syncCharacterStrength(async () =>
    Response.json({
      final_stat: [{ stat_name: "전투력", stat_value: "123456789" }],
    }),
  );
  expect(first.success).toBe(1);
  expect(db.readBook("live").characters[0].combatPower).toBe("123456789");
  db.sqlite
    .prepare("DELETE FROM leases WHERE name=?")
    .run("character-strength");
  expect(
    (
      await strength.syncCharacterStrength(async () => {
        throw Error("fresh strength must not fetch");
      })
    ).success,
  ).toBe(0);
});
it("does not interpret absent combat power as zero", () => {
  expect(strength.parseCombatPower({ final_stat: [] })).toBeNull();
  expect(() =>
    strength.parseCombatPower({
      final_stat: [{ stat_name: "전투력", stat_value: "NaN" }],
    }),
  ).toThrow();
});
