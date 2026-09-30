import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { scryptSync, timingSafeEqual } from "node:crypto";
import { ensure } from "@/domain/model";
import { consumeBudget } from "@/server/db";
export function assertOrigin(req: Request) {
  const host = req.headers.get("host") || "";
  const origin = req.headers.get("origin");
  const allowed = process.env.APP_ORIGIN || `http://${host}`;
  ensure(origin === allowed, "허용하지 않은 요청 출처예요.", 403);
  ensure(
    req.headers.get("sec-fetch-site") !== "cross-site",
    "외부 사이트 요청을 차단했어요.",
    403,
  );
}
export function localOnly(req: Request) {
  const host = req.headers.get("host") || "";
  return (
    !process.env.APP_ORIGIN && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)
  );
}
export async function session() {
  ensure(
    process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32,
    "SESSION_SECRET 설정이 필요해요.",
    503,
  );
  return getIronSession<{ owner: boolean }>(await cookies(), {
    password: process.env.SESSION_SECRET,
    cookieName: "mesolog-owner",
    ttl: 28800,
    cookieOptions: {
      httpOnly: true,
      sameSite: "strict",
      secure: !!process.env.APP_ORIGIN?.startsWith("https://"),
    },
  });
}
export async function authorize(req: Request) {
  if (!process.env.OWNER_PASSWORD_HASH) {
    ensure(localOnly(req), "공개 접속에는 소유자 인증 설정이 필요해요.", 503);
    return;
  }
  const s = await session();
  ensure(s.owner === true, "소유자 로그인이 필요해요.", 401);
}
export async function login(password: string) {
  ensure(
    await consumeBudget("owner-login", 10),
    "로그인 시도가 많아요. 24시간 뒤 다시 시도해 주세요.",
    429,
  );
  const [salt, hash] = (process.env.OWNER_PASSWORD_HASH || "").split(":");
  ensure(
    salt && hash && /^[a-f0-9]{128}$/.test(hash),
    "소유자 암호 설정이 필요해요.",
    503,
  );
  const actual = scryptSync(password, salt, 64);
  ensure(
    timingSafeEqual(actual, Buffer.from(hash, "hex")),
    "비밀번호를 확인해 주세요.",
    401,
  );
  const s = await session();
  s.owner = true;
  await s.save();
}
