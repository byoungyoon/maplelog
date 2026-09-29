import { syncReferencePrices } from "../src/server/catalog/sync-prices";
import { applyCatalogue } from "../src/server/catalog";
import { sqlite, readBook, writeBook } from "../src/server/db";
import { connectionStatus } from "../src/server/connection";
import { syncAccount } from "../src/server/nexon/sync";
let running = false;
async function tick() {
  if (running) return;
  running = true;
  try {
    const now = Date.now();
    sqlite
      .transaction(() => {
        const book = readBook("live");
        applyCatalogue(book);
        book.sync.workerSeen = new Date(now).toISOString();
        if (book.sync.focusUntil && Date.parse(book.sync.focusUntil) <= now) {
          book.sync.focusUntil = null;
          book.sync.focusCharacter = null;
        }
        book.revision++;
        writeBook(book);
      })
      .immediate();
    const book = readBook("live");
    if (
      !connectionStatus().connected ||
      !book.settings.setupDone ||
      !book.characters.length
    )
      return;
    await syncReferencePrices().catch(() => {});
    const focus =
      !!book.sync.focusUntil && Date.parse(book.sync.focusUntil) > now;
    const last = book.sync.lastRequest ? Date.parse(book.sync.lastRequest) : 0;
    // Normal polling: once per hour. Focus: chosen character every 2 minutes, max 2 hours.
    if (now - last >= (focus ? 120000 : 3600000))
      await syncAccount(
        focus && book.sync.focusCharacter
          ? { characterId: book.sync.focusCharacter }
          : {},
      );
  } catch (error) {
    console.error(
      "동기화 작업 실패:",
      error instanceof Error ? error.message : "저장 상태를 확인해 주세요.",
    );
  } finally {
    running = false;
  }
}
console.log(
  "메소로그 워커 시작 · 실제 보스 스케줄러 연결 · 기본 60분 / 집중 2분",
);
void tick();
const timer = setInterval(() => void tick(), 60000);
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, () => {
    clearInterval(timer);
    process.exit(0);
  });
