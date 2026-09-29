import { describe, it, expect, vi } from "vitest";
import { randomBytes, scryptSync } from "node:crypto";
import { sealData, unsealData } from "iron-session";
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/server/db", () => ({ consumeBudget: vi.fn(() => true) }));
import { assertOrigin, localOnly, authorize } from "@/server/auth";
describe("소유자 인증 경계", () => {
  it("설정이 없는 공개 Host는 fail closed", async () => {
    await expect(
      authorize(
        new Request("http://example.com", { headers: { host: "example.com" } }),
      ),
    ).rejects.toThrow("소유자 인증 설정");
  });
  it("localhost는 Origin 검증 후에만 변경을 허용한다", () => {
    const good = new Request("http://localhost:3000", {
      headers: { host: "localhost:3000", origin: "http://localhost:3000" },
    });
    expect(localOnly(good)).toBe(true);
    expect(() => assertOrigin(good)).not.toThrow();
    expect(() =>
      assertOrigin(
        new Request("http://localhost:3000", {
          headers: { host: "localhost:3000", origin: "https://evil.test" },
        }),
      ),
    ).toThrow();
    expect(() =>
      assertOrigin(
        new Request("http://localhost:3000", {
          headers: { host: "localhost:3000" },
        }),
      ),
    ).toThrow();
  });
  it("검증된 session seal은 변조한 owner 권한을 허용하지 않는다", async () => {
    const password = randomBytes(32).toString("hex");
    const seal = await sealData({ owner: true }, { password, ttl: 3600 });
    expect(await unsealData(seal, { password })).toEqual({ owner: true });
    expect(
      await unsealData(
        seal.slice(0, 60) + (seal[60] === "A" ? "B" : "A") + seal.slice(61),
        { password },
      ),
    ).not.toEqual({
      owner: true,
    });
  });
  it("서버 비밀번호 설정은 salt와 scrypt 해시로 생성한다", () => {
    const salt = randomBytes(16).toString("hex");
    const good = scryptSync("a-test-password", salt, 64);
    expect(scryptSync("a-different-password", salt, 64)).not.toEqual(good);
  });
});
