import { applyCatalogue } from "@/server/catalog";
import { acquireLease, editBookWithCredential, readBook, setLease } from "@/server/db";
import { credentialForRequest, credentialIsCurrent } from "@/server/connection";
import { DomainError, ensure } from "@/domain/model";
import { fetchScheduler, fetchCharacterImage } from "./scheduler";
import { mergeScheduler } from "./normalize";
// Shared durable lease coalesces browser tabs and the independent worker. No upstream work in GET.
export async function syncAccount(
  options: { characterId?: string; fetcher?: typeof fetch } = {},
) {
  const credential = await credentialForRequest();
  const leaseName = "scheduler-sync";
  const acquired = await acquireLease(leaseName, 120000);
  if (!acquired) return { coalesced: true, success: 0, failed: 0, empty: 0 };
  let success = 0,
    failed = 0,
    empty = 0;
  const errors: string[] = [];
  try {
    await editBookWithCredential(credential.generation, (book) => {
      applyCatalogue(book);
      book.sync.lastRequest = new Date().toISOString();
    });
    const initial = await readBook("live");
    const characters = initial.characters.filter(
      (c) => !options.characterId || c.id === options.characterId,
    );
    ensure(characters.length, "조회할 캐릭터가 없어요.");
    for (const char of characters) {
      ensure(
        await credentialIsCurrent(credential.generation),
        "키 연결이 변경되어 조회를 중단했어요.",
        409,
      );
      // Renew before each potentially slow request; release only our own lease.
      await setLease(leaseName, Date.now() + 120000);
      try {
        const data = await fetchScheduler(credential.key, char.id, {
          generation: credential.generation,
          budget: initial.settings.dailyBudget,
          fetcher: options.fetcher,
        });
        await editBookWithCredential(credential.generation, (book) => {
            if (!book.characters.some((c) => c.id === char.id))
              return;
            mergeScheduler(book, char.id, data);
            book.sync.lastSuccess = new Date().toISOString();
          });
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
            await editBookWithCredential(credential.generation, (book) => {
                const current = book.characters.find((c) => c.id === char.id);
                if (current) {
                  current.image = image;
                  current.imageUpdatedAt = new Date().toISOString();
                }
              });
          } catch {
            /* A portrait failure does not invalidate a successful boss observation. */
          }
        }
      } catch (error) {
        if (!(await credentialIsCurrent(credential.generation))) throw error;
        failed++;
        const message =
          error instanceof DomainError
            ? error.message
            : "스케줄러 조회 중 오류가 발생했어요.";
        errors.push(message);
        await editBookWithCredential(credential.generation, (book) => {
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
          });
        if (error instanceof DomainError && [401, 429].includes(error.status))
          break;
      }
    }
    await editBookWithCredential(credential.generation, (book) => {
        book.sync.error = errors.length
          ? `${failed}개 캐릭터 조회 실패 · ${errors[0]}`
          : null;
      });
    return { coalesced: false, success, failed, empty };
  } finally {
    await setLease(leaseName, Date.now() + 15000);
  }
}
