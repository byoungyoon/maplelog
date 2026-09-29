import { sqlite, readBook, writeBook } from "@/server/db";
import { ensure } from "@/domain/model";
import { audit } from "@/domain/commands";
import { encryptCredential, decryptCredential } from "./crypto";
import { verifyCharacterKey } from "@/server/nexon/characters";
interface CredentialRow {
  encrypted: string;
  fingerprint: string;
  verified_at: string;
  account_signature: string;
  generation: number;
}
export function connectionStatus() {
  const row = sqlite.prepare("SELECT * FROM credentials WHERE id=1").get() as
    CredentialRow | undefined;
  if (!row) return { connected: false, verifiedAt: null as string | null };
  try {
    decryptCredential(row.encrypted);
  } catch {
    return { connected: false, verifiedAt: null as string | null };
  }
  return { connected: true, verifiedAt: row.verified_at };
}
export async function connectKey(key: string, fetcher: typeof fetch = fetch) {
  const encrypted = encryptCredential(key); // Fail before using API budget if storage is unavailable.
  const generation = sqlite
    .transaction(() => {
      sqlite
        .prepare(
          "UPDATE connection_lock SET generation=generation+1 WHERE id=1",
        )
        .run();
      return (
        sqlite
          .prepare("SELECT generation FROM connection_lock WHERE id=1")
          .get() as { generation: number }
      ).generation;
    })
    .immediate();
  const result = await verifyCharacterKey(key, fetcher);
  sqlite
    .transaction(() => {
      ensure(
        (
          sqlite
            .prepare("SELECT generation FROM connection_lock WHERE id=1")
            .get() as { generation: number }
        ).generation === generation,
        "더 최근의 연결 요청이 있어 이 결과를 저장하지 않았어요.",
        409,
      );
      const previous = sqlite
        .prepare("SELECT * FROM credentials WHERE id=1")
        .get() as CredentialRow | undefined;
      const book = readBook("live");
      ensure(
        !previous ||
          previous.account_signature === result.accountSignature ||
          book.completions.length === 0,
        "다른 계정의 키예요. 기존 장부와 자동으로 합칠 수 없어요.",
        409,
      );
      const fresh = result.characters.map((c) => {
        const old = book.characters.find((x) => x.id === c.id);
        return old
          ? {
              ...c,
              image: old.image,
              imageUpdatedAt: old.imageUpdatedAt,
              managed: old.managed,
              favorite: old.favorite,
              order: old.order,
            }
          : c;
      });
      book.characters = [
        ...fresh,
        ...book.characters
          .filter((c) => !fresh.some((n) => n.id === c.id))
          .map((c) => ({ ...c, managed: false })),
      ];
      book.revision++;
      audit(book, "API 키 연결", "본인 캐릭터 목록 확인");
      writeBook(book);
      sqlite
        .prepare(
          "INSERT INTO credentials(id,encrypted,fingerprint,account_signature,verified_at,generation) VALUES(1,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET encrypted=excluded.encrypted,fingerprint=excluded.fingerprint,account_signature=excluded.account_signature,verified_at=excluded.verified_at,generation=excluded.generation",
        )
        .run(
          encrypted,
          result.fingerprint,
          result.accountSignature,
          new Date().toISOString(),
          generation,
        );
    })
    .immediate();
  return connectionStatus();
}
export function disconnect() {
  sqlite
    .transaction(() => {
      sqlite
        .prepare(
          "UPDATE connection_lock SET generation=generation+1 WHERE id=1",
        )
        .run();
      sqlite.prepare("DELETE FROM credentials").run();
      const book = readBook("live");
      book.sync.focusUntil = null;
      book.sync.focusCharacter = null;
      book.settings.setupDone = false;
      book.revision++;
      writeBook(book);
    })
    .immediate();
}

export function credentialForRequest() {
  const row = sqlite.prepare("SELECT * FROM credentials WHERE id=1").get() as
    CredentialRow | undefined;
  ensure(row, "API 키를 먼저 연결해 주세요.", 428);
  return {
    key: decryptCredential(row.encrypted),
    generation: row.generation,
    fingerprint: row.fingerprint,
  };
}
export function credentialIsCurrent(generation: number) {
  return (
    (
      sqlite.prepare("SELECT generation FROM credentials WHERE id=1").get() as
        { generation: number } | undefined
    )?.generation === generation
  );
}
