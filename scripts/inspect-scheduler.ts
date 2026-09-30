import { credentialForRequest } from "../src/server/connection";
import { readBook } from "../src/server/db";
import { fetchScheduler } from "../src/server/nexon/scheduler";
const credential = await credentialForRequest();
const characters = (await readBook("live")).characters.filter((c) => c.managed);
for (const character of characters) {
  const data = await fetchScheduler(credential.key, character.id, {
    generation: credential.generation,
  });
  console.log(
    JSON.stringify(
      {
        date: data.date,
        cycles: [...new Set(data.boss_contents.map((b) => b.cycle))],
        difficulties: [...new Set(data.boss_contents.map((b) => b.difficulty))],
        bossCount: data.boss_contents.length,
        completed: data.boss_contents
          .filter((b) => b.complete_flag === "true")
          .map((b) => ({
            name: b.content_name,
            difficulty: b.difficulty,
            cycle: b.cycle,
          })),
        weeklyClearCount: data.weekly_boss_clear_count,
        weeklyClearLimit: data.weekly_boss_clear_limit_count,
      },
      null,
      2,
    ),
  );
}
