import { getApps, initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
import { applySoloPolicy } from "@/domain/solo";
import { applyCommand, type Command } from "@/domain/commands";
import { ensure, validateLedger, type Ledger, type Mode } from "@/domain/model";

let instance: Firestore | undefined;
export type AccountScope = { id: string; legacy: boolean };
const accountStorage = new AsyncLocalStorage<AccountScope>();
export function withAccount<T>(account: AccountScope, task: () => T): T {
  return accountStorage.run(account, task);
}
export const currentAccount = () => accountStorage.getStore();

export function accountCollection(name: string) {
  const account = accountStorage.getStore();
  if (!account) {
    ensure(process.env.VERCEL !== "1", "계정 범위가 설정되지 않았어요.", 500);
    return firestore().collection(name);
  }
  return account.legacy
    ? firestore().collection(name)
    : firestore().collection("accounts").doc(account.id).collection(name);
}
export function firestore() {
  if (instance) return instance;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  ensure(projectId, "FIREBASE_PROJECT_ID 설정이 필요해요.", 503);
  const localKey = path.resolve(".local-secrets/firebase-service-account.json");
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    (existsSync(localKey) ? readFileSync(localKey, "utf8") : null);
  const credential = raw ? cert(JSON.parse(raw)) : applicationDefault();
  const app = getApps()[0] || initializeApp({ credential, projectId });
  instance = getFirestore(app);
  return instance;
}

export const bookRef = (mode: Mode) => accountCollection("books").doc(mode);
export const leaseRef = (name: string) =>
  accountCollection("leases").doc(encodeURIComponent(name));
export const credentialRef = () => accountCollection("private").doc("credential");
export const connectionLockRef = () => accountCollection("private").doc("connection-lock");
export const analysisRef = (characterId: string) =>
  accountCollection("boss-analyses").doc(encodeURIComponent(characterId));

export function decodeLedger(data: FirebaseFirestore.DocumentData | undefined): Ledger {
  ensure(data?.payloadGzip || data?.payload,
    "Firestore 장부가 아직 이전되지 않았어요.", 503);
  const raw = data.payloadGzip
    ? gunzipSync(Buffer.from(data.payloadGzip, "base64")).toString("utf8")
    : data.payload;
  return validateLedger(JSON.parse(raw));
}

export function encodeLedger(book: Ledger) {
  const payloadGzip = gzipSync(JSON.stringify(validateLedger(book))).toString("base64");
  return { revision: book.revision, payloadGzip };
}

export async function readBook(mode: Mode): Promise<Ledger> {
  return decodeLedger((await bookRef(mode).get()).data());
}

export async function editBook<T>(edit: (book: Ledger) => T): Promise<T> {
  const ref = bookRef("live");
  return firestore().runTransaction(async (tx) => {
    const book = decodeLedger((await tx.get(ref)).data());
    const revision = book.revision;
    const result = edit(book);
    applySoloPolicy(book);
    book.revision = revision + 1;
    tx.set(ref, encodeLedger(book));
    return result;
  });
}

export async function editBookWithCredential<T>(
  generation: number,
  edit: (book: Ledger) => T,
): Promise<T> {
  const ref = bookRef("live");
  const credential = credentialRef();
  return firestore().runTransaction(async (tx) => {
    const [bookDoc, credentialDoc] = await Promise.all([tx.get(ref), tx.get(credential)]);
    ensure(credentialDoc.get("generation") === generation,
      "키 연결이 변경되어 결과를 저장하지 않았어요.", 409);
    const book = decodeLedger(bookDoc.data());
    const revision = book.revision;
    const result = edit(book);
    applySoloPolicy(book);
    book.revision = revision + 1;
    tx.set(ref, encodeLedger(book));
    return result;
  });
}

export async function mutate(
  mode: Mode,
  revision: number,
  requestId: string,
  command: Command,
): Promise<Ledger> {
  const ref = bookRef(mode);
  const requestRef = accountCollection("requests").doc(`${mode}:${requestId}`);
  const fingerprint = createHash("sha256").update(JSON.stringify(command)).digest("hex");
  return firestore().runTransaction(async (tx) => {
    const [bookDoc, prior] = await Promise.all([tx.get(ref), tx.get(requestRef)]);
    const book = decodeLedger(bookDoc.data());
    if (prior.exists) {
      ensure(prior.get("fingerprint") === fingerprint,
        "재전송 식별자가 다른 요청에 사용되었어요.", 409);
      return book;
    }
    ensure(book.revision === revision,
      "다른 창에서 기록이 바뀌었어요. 최신값을 확인하고 다시 시도해 주세요.", 409);
    if (command.type === "sync" && command.scenario === "refresh" &&
      book.sync.lastRequest && Date.now() - Date.parse(book.sync.lastRequest) < 15000)
      return book;
    applyCommand(book, command);
    if (command.type === "sync") book.sync.lastRequest = new Date().toISOString();
    book.revision++;
    applySoloPolicy(book);
    tx.set(ref, encodeLedger(book));
    tx.create(requestRef, { fingerprint });
    return book;
  });
}

export async function acquireLease(name: string, durationMs: number) {
  const ref = leaseRef(name);
  return firestore().runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (((doc.get("untilAt") as number | undefined) ?? 0) > Date.now()) return false;
    tx.set(ref, { untilAt: Date.now() + durationMs });
    return true;
  });
}

export async function leaseUntil(name: string) {
  return ((await leaseRef(name).get()).get("untilAt") as number | undefined) ?? 0;
}

export async function setLease(name: string, untilAt: number) {
  await leaseRef(name).set({ untilAt });
}

export async function consumeBudget(provider: string, budget: number, now = Date.now()) {
  const shared = provider === "owner-login" || provider === "connection-attempts";
  const ref = (shared ? firestore().collection("usage") : accountCollection("usage"))
    .doc(encodeURIComponent(provider));
  return firestore().runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    const times = ((doc.get("times") as number[] | undefined) ?? [])
      .filter((at) => at >= now - 86400000);
    if (times.length >= budget || times.filter((at) => at > now - 1000).length >= 5)
      return false;
    times.push(now);
    tx.set(ref, { provider, times });
    return true;
  });
}

export async function usageCount(provider: string) {
  const doc = await accountCollection("usage").doc(encodeURIComponent(provider)).get();
  return ((doc.get("times") as number[] | undefined) ?? [])
    .filter((at) => at > Date.now() - 86400000).length;
}
