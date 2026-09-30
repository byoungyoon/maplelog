import { bookRef, connectionLockRef, credentialRef, decodeLedger, encodeLedger, firestore } from "@/server/db";
import { ensure } from "@/domain/model";
import { audit } from "@/domain/commands";
import { encryptCredential, decryptCredential } from "./crypto";
import { verifyCharacterKey } from "@/server/nexon/characters";

interface CredentialRow {
  encrypted: string;
  fingerprint: string;
  verifiedAt: string;
  accountSignature: string;
  generation: number;
}

export async function connectionStatus() {
  const row = (await credentialRef().get()).data() as CredentialRow | undefined;
  if (!row) return { connected: false, verifiedAt: null as string | null };
  try {
    decryptCredential(row.encrypted);
  } catch {
    return { connected: false, verifiedAt: null as string | null };
  }
  return { connected: true, verifiedAt: row.verifiedAt };
}

export async function connectKey(key: string, fetcher: typeof fetch = fetch) {
  const encrypted = encryptCredential(key);
  const lock = connectionLockRef();
  const generation = await firestore().runTransaction(async (tx) => {
    const current = await tx.get(lock);
    const next = ((current.get("generation") as number | undefined) ?? 0) + 1;
    tx.set(lock, { generation: next });
    return next;
  });
  const result = await verifyCharacterKey(key, fetcher);
  const credential = credentialRef();
  const bookReference = bookRef("live");
  await firestore().runTransaction(async (tx) => {
    const [lockDoc, previousDoc, bookDoc] = await Promise.all([
      tx.get(lock), tx.get(credential), tx.get(bookReference),
    ]);
    ensure(lockDoc.get("generation") === generation,
      "더 최근의 연결 요청이 있어 이 결과를 저장하지 않았어요.", 409);
    const previous = previousDoc.data() as CredentialRow | undefined;
    const book = decodeLedger(bookDoc.data());
    ensure(!previous || previous.accountSignature === result.accountSignature ||
      book.completions.length === 0,
      "다른 계정의 키예요. 기존 장부와 자동으로 합칠 수 없어요.", 409);
    const fresh = result.characters.map((character) => {
      const old = book.characters.find((existing) => existing.id === character.id);
      return old ? {
        ...character,
        image: old.image,
        imageUpdatedAt: old.imageUpdatedAt,
        combatPower: old.combatPower,
        combatPowerCheckedAt: old.combatPowerCheckedAt,
        managed: old.managed,
        favorite: old.favorite,
        order: old.order,
      } : character;
    });
    book.characters = [
      ...fresh,
      ...book.characters.filter((character) =>
        !fresh.some((next) => next.id === character.id))
        .map((character) => ({ ...character, managed: false })),
    ];
    book.settings.setupDone = true;
    book.revision++;
    audit(book, "API 키 연결", "본인 캐릭터 목록 확인");
    tx.set(bookReference, encodeLedger(book));
    tx.set(credential, {
      encrypted,
      fingerprint: result.fingerprint,
      accountSignature: result.accountSignature,
      verifiedAt: new Date().toISOString(),
      generation,
    } satisfies CredentialRow);
  });
  return connectionStatus();
}

export async function disconnect() {
  const lock = connectionLockRef();
  const credential = credentialRef();
  const reference = bookRef("live");
  await firestore().runTransaction(async (tx) => {
    const [lockDoc, bookDoc] = await Promise.all([tx.get(lock), tx.get(reference)]);
    const book = decodeLedger(bookDoc.data());
    book.sync.focusUntil = null;
    book.sync.focusCharacter = null;
    book.settings.setupDone = false;
    book.revision++;
    tx.set(reference, encodeLedger(book));
    tx.set(lock, { generation: ((lockDoc.get("generation") as number | undefined) ?? 0) + 1 });
    tx.delete(credential);
  });
}

export async function credentialForRequest() {
  const row = (await credentialRef().get()).data() as CredentialRow | undefined;
  ensure(row, "API 키를 먼저 연결해 주세요.", 428);
  return {
    key: decryptCredential(row.encrypted),
    generation: row.generation,
    fingerprint: row.fingerprint,
  };
}

export async function credentialIsCurrent(generation: number) {
  return ((await credentialRef().get()).get("generation") as number | undefined) === generation;
}
