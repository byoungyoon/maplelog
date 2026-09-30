import { z } from "zod";
import { DomainError, ensure, money } from "@/domain/model";
import { acquireLease, editBookWithCredential, readBook, setLease } from "@/server/db";
import { credentialForRequest, credentialIsCurrent } from "@/server/connection";
import { nexonRequest } from "./client";

const statResponse = z.object({
  final_stat: z.array(
    z.object({ stat_name: z.string(), stat_value: z.string() }),
  ),
});

export function parseCombatPower(raw: unknown): string | null {
  const response = statResponse.parse(raw);
  const power = response.final_stat.find((s) => s.stat_name === "전투력");
  return power ? money.parse(power.stat_value) : null;
}

export async function syncCharacterStrength(fetcher: typeof fetch = fetch) {
  const credential = await credentialForRequest();
  const lease = "character-strength";
  const acquired = await acquireLease(lease, 120000);
  if (!acquired) return { coalesced: true, success: 0, failed: 0 };
  let success = 0,
    failed = 0,
    consecutiveFailures = 0;
  try {
    const initial = await readBook("live");
    const due = initial.characters.filter(
      (c) =>
        !c.combatPowerCheckedAt ||
        Date.now() - Date.parse(c.combatPowerCheckedAt) > 86400000,
    );
    for (const character of due) {
      ensure(
        await credentialIsCurrent(credential.generation),
        "키 연결이 변경되어 전투력 조회를 중단했어요.",
        409,
      );
      await setLease(lease, Date.now() + 120000);
      try {
        const raw = await nexonRequest(
          credential.key,
          "/maplestory/v1/character/stat",
          { ocid: character.id },
          {
            generation: credential.generation,
            budget: initial.settings.dailyBudget,
            fetcher,
          },
        );
        const power = parseCombatPower(raw);
        await editBookWithCredential(credential.generation, (book) => {
            const current = book.characters.find((c) => c.id === character.id);
            if (!current) return;
            current.combatPower = power;
            current.combatPowerCheckedAt = new Date().toISOString();
          });
        success++;
        consecutiveFailures = 0;
      } catch (error) {
        if (!(await credentialIsCurrent(credential.generation))) throw error;
        failed++;
        consecutiveFailures++;
        if (
          consecutiveFailures >= 3 ||
          (error instanceof DomainError && [401, 429].includes(error.status))
        )
          break;
      }
    }
    return { coalesced: false, success, failed };
  } finally {
    await setLease(lease, Date.now() + 60000);
  }
}
