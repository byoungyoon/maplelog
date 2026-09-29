import { applyCatalogue } from "@/server/catalog";
import { sqlite, readBook, writeBook } from "@/server/db";
import { credentialForRequest, credentialIsCurrent } from "@/server/connection";
import { DomainError, ensure } from "@/domain/model";
import { fetchScheduler, fetchCharacterImage } from "./scheduler";
import { mergeScheduler } from "./normalize";
// Shared durable lease coalesces browser tabs and the independent worker. No upstream work in GET.
export async function syncAccount(
  options: { characterId?: string; fetcher?: typeof fetch } = {},
) {
  const credential = credentialForRequest();
  const leaseName = "scheduler-sync";
  const leaseUntil = Date.now() + 120000;
  const acquired = sqlite
    .transaction(() => {
      const old = sqlite
        .prepare("SELECT until_at FROM leases WHERE name=?")
        .get(leaseName) as { until_at: number } | undefined;
      if (old && old.until_at > Date.now()) return false;
      sqlite
        .prepare(
          "INSERT INTO leases(name,until_at) VALUES(?,?) ON CONFLICT(name) DO UPDATE SET until_at=excluded.until_at",
        )
        .run(leaseName, leaseUntil);
      const s = readBook("live");
      applyCatalogue(s);
      s.sync.lastRequest = new Date().toISOString();
      s.revision++;
      writeBook(s);
      return true;
    })
    .immediate();
  if (!acquired) return { coalesced: true, success: 0, failed: 0, empty: 0 };
  let success = 0,
    failed = 0,
    empty = 0;
  const errors: string[] = [];
  try {
    const initial = readBook("live");
    const characters = initial.characters.filter(
      (c) => !options.characterId || c.id === options.characterId,
    );
    ensure(characters.length, "조회할 캐릭터가 없어요.");
    for (const char of characters) {
      ensure(
        credentialIsCurrent(credential.generation),
        "키 연결이 변경되어 조회를 중단했어요.",
        409,
      );
      // Renew before each potentially slow request; release only our own lease.
      sqlite
        .prepare("UPDATE leases SET until_at=? WHERE name=?")
        .run(Date.now() + 120000, leaseName);
      try {
        const data = await fetchScheduler(credential.key, char.id, {
          generation: credential.generation,
          budget: initial.settings.dailyBudget,
          fetcher: options.fetcher,
        });
        sqlite
          .transaction(() => {
            ensure(
              credentialIsCurrent(credential.generation),
              "키 연결이 변경되어 결과를 저장하지 않았어요.",
              409,
            );
            const book = readBook("live");
            if (!book.characters.some((c) => c.id === char.id))
              return;
            mergeScheduler(book, char.id, data);
            book.sync.lastSuccess = new Date().toISOString();
            book.revision++;
            writeBook(book);
          })
          .immediate();
        success++;
        if (!data.boss_contents.length) empty++;
        if (
          !char.imageUpdatedAt ||
          Date.now() - Date.parse(char.imageUpdatedAt) > 86400000
        ) {
          try {
            const image = await fetchCharacterImage(credential.key, char.id, {
              generation: credential.generation,
              budget: initial.settings.dailyBudget,
              fetcher: options.fetcher,
            });
            sqlite
              .transaction(() => {
                if (!credentialIsCurrent(credential.generation)) return;
                const book = readBook("live");
                const current = book.characters.find((c) => c.id === char.id);
                if (current) {
                  current.image = image;
                  current.imageUpdatedAt = new Date().toISOString();
                  book.revision++;
                  writeBook(book);
                }
              })
              .immediate();
          } catch {
            /* A portrait failure does not invalidate a successful boss observation. */
          }
        }
      } catch (error) {
        if (!credentialIsCurrent(credential.generation)) throw error;
        failed++;
        const message =
          error instanceof DomainError
            ? error.message
            : "스케줄러 조회 중 오류가 발생했어요.";
        errors.push(message);
        sqlite
          .transaction(() => {
            const book = readBook("live");
            const previous = book.sync.characters?.find(
              (c) => c.characterId === char.id,
            );
            book.sync.characters = (book.sync.characters ?? []).filter(
              (c) => c.characterId !== char.id,
            );
            book.sync.characters.push({
              characterId: char.id,
              checkedAt: new Date().toISOString(),
              sourceAsOf: previous?.sourceAsOf ?? null,
              status: "error",
              message,
              bossCount: previous?.bossCount ?? 0,
              weeklyClearCount: previous?.weeklyClearCount ?? 0,
              weeklyClearLimit: previous?.weeklyClearLimit ?? 0,
            });
            book.revision++;
            writeBook(book);
          })
          .immediate();
        if (error instanceof DomainError && [401, 429].includes(error.status))
          break;
      }
    }
    sqlite
      .transaction(() => {
        if (!credentialIsCurrent(credential.generation)) return;
        const book = readBook("live");
        book.sync.error = errors.length
          ? `${failed}개 캐릭터 조회 실패 · ${errors[0]}`
          : null;
        book.revision++;
        writeBook(book);
      })
      .immediate();
    return { coalesced: false, success, failed, empty };
  } finally {
    sqlite
      .prepare("UPDATE leases SET until_at=? WHERE name=?")
      .run(Date.now() + 15000, leaseName);
  }
}
