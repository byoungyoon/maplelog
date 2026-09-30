import { afterEach, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { characterListFixture } from "./fixtures/nexon";

const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => jar.has(name) ? { name, value: jar.get(name) } : undefined,
    set: (name: string, value: string) => { jar.set(name, value); },
  }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  jar.clear();
});

it("Firestore에 등록되지 않은 유효한 API 키로 로그인하고 계정별 장부를 연다", async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST)
    throw new Error("Firestore emulator is required for login tests");
  process.env.SESSION_SECRET = randomBytes(32).toString("hex");
  process.env.CREDENTIAL_ENCRYPTION_KEY = randomBytes(32).toString("hex");
  const firstFixture = structuredClone(characterListFixture);
  firstFixture.account_list[0].account_id = "login-first-account";
  const secondFixture = structuredClone(characterListFixture);
  secondFixture.account_list[0].account_id = "login-second-account";
  secondFixture.account_list[0].character_list[0].ocid = "second-login-ocid";
  vi.stubGlobal("fetch", async (_url: string, options: RequestInit) => {
    const key = (options.headers as Record<string, string>)["x-nxopen-api-key"];
    return Response.json(key === "first-login-key" ? firstFixture : secondFixture);
  });
  const { firestore, readBook, withAccount } = await import("@/server/db");
  const { authorize, login } = await import("@/server/auth");
  await firestore().collection("private").doc("credential").delete();
  const first = await login("first-login-key");
  expect(first.legacy).toBe(false);
  expect(jar.has("mesolog-owner")).toBe(true);
  const request = new Request("https://maplelog-khaki.vercel.app/api/book", {
    headers: { host: "maplelog-khaki.vercel.app" },
  });
  expect(await authorize(request)).toEqual(first);
  const firstBook = await withAccount(first, () => readBook("live"));
  expect(firstBook.characters[0].id).toBe("test-ocid");
  const second = await login("second-login-key");
  expect(second.id).not.toBe(first.id);
  expect(await authorize(request)).toEqual(second);
  expect((await withAccount(second, () => readBook("live"))).characters[0].id)
    .toBe("second-login-ocid");
  expect((await withAccount(first, () => readBook("live"))).characters[0].id)
    .toBe("test-ocid");
});
