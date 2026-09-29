import { applySoloPolicy } from "@/domain/solo";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { books } from "./schema";
import { emptyLedger } from "@/domain/empty-ledger";
import { ensure, validateLedger, type Ledger, type Mode } from "@/domain/model";
import { applyCommand, type Command } from "@/domain/commands";
const dir = process.env.DATA_DIR || path.join(process.cwd(), "data");
mkdirSync(dir, { recursive: true, mode: 0o700 });
export const sqlite = new Database(path.join(dir, "mesolog.sqlite"));
sqlite.pragma("busy_timeout = 5000");
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
sqlite.exec(
  readFileSync(path.join(process.cwd(), "src/server/db/migration.sql"), "utf8"),
);
export const db = drizzle(sqlite);
db.insert(books)
  .values({ mode: "live", revision: 0, payload: JSON.stringify(emptyLedger()) })
  .onConflictDoNothing()
  .run();
export function readBook(mode: Mode): Ledger {
  const row = db.select().from(books).where(eq(books.mode, mode)).get()!;
  return JSON.parse(row.payload);
}
export function writeBook(s: Ledger) {
  applySoloPolicy(s);
  validateLedger(s);
  db.update(books)
    .set({ revision: s.revision, payload: JSON.stringify(s) })
    .where(eq(books.mode, s.mode))
    .run();
}
export function mutate(
  mode: Mode,
  revision: number,
  requestId: string,
  command: Command,
): Ledger {
  return sqlite
    .transaction(() => {
      const s = readBook(mode);
      const fingerprint = createHash("sha256")
        .update(JSON.stringify(command))
        .digest("hex");
      const prior = sqlite
        .prepare("SELECT fingerprint FROM requests WHERE mode=? AND id=?")
        .get(mode, requestId) as { fingerprint: string } | undefined;
      if (prior) {
        ensure(
          prior.fingerprint === fingerprint,
          "재전송 식별자가 다른 요청에 사용되었어요.",
          409,
        );
        return s;
      }
      ensure(
        s.revision === revision,
        "다른 창에서 기록이 바뀌었어요. 최신값을 확인하고 다시 시도해 주세요.",
        409,
      );
      if (
        command.type === "sync" &&
        command.scenario === "refresh" &&
        s.sync.lastRequest &&
        Date.now() - new Date(s.sync.lastRequest).getTime() < 15000
      )
        return s;
      applyCommand(s, command);
      if (command.type === "sync")
        s.sync.lastRequest = new Date().toISOString();
      s.revision++;
      writeBook(s);
      sqlite
        .prepare("INSERT INTO requests(mode,id,fingerprint) VALUES(?,?,?)")
        .run(mode, requestId, fingerprint);
      return s;
    })
    .immediate();
}
export function consumeBudget(
  provider: string,
  budget: number,
  now = Date.now(),
): boolean {
  return sqlite
    .transaction(() => {
      sqlite.prepare("DELETE FROM usage WHERE at < ?").run(now - 86400000);
      const daily = sqlite
        .prepare("SELECT count(*) AS n FROM usage WHERE provider=?")
        .get(provider) as { n: number };
      const second = sqlite
        .prepare("SELECT count(*) AS n FROM usage WHERE provider=? AND at>?")
        .get(provider, now - 1000) as { n: number };
      if (daily.n >= budget || second.n >= 5) return false;
      sqlite
        .prepare("INSERT INTO usage(provider,at) VALUES(?,?)")
        .run(provider, now);
      return true;
    })
    .immediate();
}
export function usageCount(provider: string) {
  return (
    sqlite
      .prepare("SELECT count(*) AS n FROM usage WHERE provider=? AND at>?")
      .get(provider, Date.now() - 86400000) as { n: number }
  ).n;
}

// Upgrade existing personal expectations once; preserve paid settlements and snapshots.
sqlite
  .transaction(() => {
    const book = readBook("live");
    if (applySoloPolicy(book)) {
      book.revision++;
      writeBook(book);
    }
  })
  .immediate();
