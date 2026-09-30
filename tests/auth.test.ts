import { describe, it, expect, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { sealData, unsealData } from "iron-session";
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/server/db", () => ({ consumeBudget: vi.fn(() => true) }));
import { assertOrigin, localOnly, authorize } from "@/server/auth";
describe("소유자 인증 경계", () => {
  it("공개 Host는 로그인 세션 없이 접근할 수 없다", async () => {
    await expect(
      authorize(
        new Request("http://example.com", { headers: { host: "example.com" } }),
      ),
    ).rejects.toThrow();
  });
  it("localhost는 Origin 검증 후에만 변경을 허용한다", () => {
    const good = new Request("http://localhost:3000", {
      headers: { host: "localhost:3000", origin: "http://localhost:3000" },
    });
    expect(localOnly(good)).toBe(true);
    vi.stubEnv("VERCEL", "1");
    expect(localOnly(good)).toBe(false);
    vi.unstubAllEnvs();
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
  it("HTTPS 배포 주소의 동일 출처 요청을 허용한다", () => {
    const url = "https://maplelog-khaki.vercel.app/api/auth/login";
    expect(() => assertOrigin(new Request(url, {
      headers: {
        host: "maplelog-khaki.vercel.app",
        origin: "https://maplelog-khaki.vercel.app",
      },
    }))).not.toThrow();
    expect(() => assertOrigin(new Request(url, {
      headers: {
        host: "maplelog-khaki.vercel.app",
        origin: "https://other.example.com",
      },
    }))).toThrow("허용하지 않은 요청 출처");
    expect(() => assertOrigin(new Request("http://internal:3000/api/auth/login", {
      headers: {
        host: "maplelog-khaki.vercel.app",
        "x-forwarded-proto": "https",
        origin: "https://maplelog-khaki.vercel.app",
      },
    }))).not.toThrow();
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
});
