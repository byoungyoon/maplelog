import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { ensure } from "@/domain/model";
import { consumeBudget, firestore, withAccount, type AccountScope } from "@/server/db";
import { connectLoginKey } from "@/server/connection";
import { verifyCharacterKey } from "@/server/nexon/characters";
export function assertOrigin(req: Request) {
  const url = new URL(req.url);
  const host = req.headers.get("host") || url.host;
  const forwarded = req.headers.get("x-forwarded-proto");
  const protocol = forwarded === "https" ? "https:" : url.protocol;
  const origin = req.headers.get("origin");
  const allowed = process.env.APP_ORIGIN || `${protocol}//${host}`;
  ensure(origin === allowed, "허용하지 않은 요청 출처예요.", 403);
  ensure(
    req.headers.get("sec-fetch-site") !== "cross-site",
    "외부 사이트 요청을 차단했어요.",
    403,
  );
}
export function localOnly(req: Request) {
  const host = req.headers.get("host") || "";
  const hostname = new URL(req.url).hostname;
  return (
    process.env.VERCEL !== "1" && !process.env.APP_ORIGIN &&
    /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) &&
    /^(localhost|127\.0\.0\.1)$/.test(hostname)
  );
}
export async function session() {
  ensure(
    process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32,
    "SESSION_SECRET 설정이 필요해요.",
    503,
  );
  return getIronSession<{ accountId?: string; legacy?: boolean }>(await cookies(), {
    password: process.env.SESSION_SECRET,
    cookieName: "mesolog-owner",
    ttl: 28800,
    cookieOptions: {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.APP_ORIGIN?.startsWith("https://") || process.env.VERCEL === "1",
    },
  });
}
export async function authorize(req: Request) {
  if (localOnly(req) && !process.env.SESSION_SECRET)
    return { id: "local-legacy", legacy: true } satisfies AccountScope;
  const s = await session();
  if (s.accountId && /^[a-f0-9]{64}$/.test(s.accountId))
    return { id: s.accountId, legacy: s.legacy === true } satisfies AccountScope;
  if (localOnly(req))
    return { id: "local-legacy", legacy: true } satisfies AccountScope;
  ensure(false, "Nexon API 키로 로그인해 주세요.", 401);
}
export async function login(key: string) {
  ensure(
    await consumeBudget("owner-login", 10),
    "로그인 시도가 많아요. 24시간 뒤 다시 시도해 주세요.",
    429,
  );
  const verified = await withAccount({ id: "login-check", legacy: true }, () =>
    verifyCharacterKey(key));
  const legacyCredential = await firestore().collection("private").doc("credential").get();
  const account = {
    id: verified.accountSignature,
    legacy: legacyCredential.get("accountSignature") === verified.accountSignature,
  } satisfies AccountScope;
  await withAccount(account, () => connectLoginKey(key, verified));
  if (!account.legacy)
    await firestore().collection("accounts").doc(account.id)
      .set({ lastLoginAt: new Date().toISOString() }, { merge: true });
  const s = await session();
  s.accountId = account.id;
  s.legacy = account.legacy;
  await s.save();
  return account;
}
