import { z } from "zod";
import { nexonRequest } from "./client";
import { createHash } from "node:crypto";
import { DomainError, ensure, type Character } from "@/domain/model";
import { consumeBudget } from "@/server/db";
// From the official 14_ko_script20260917040003.yaml, inspected 2026-09-29.
export const characterListResponse = z.object({
  account_list: z.array(
    z.object({
      account_id: z.string(),
      character_list: z.array(
        z.object({
          ocid: z.string().min(1),
          character_name: z.string(),
          world_name: z.string(),
          character_class: z.string(),
          character_level: z.number().int(),
        }),
      ),
    }),
  ),
});
export async function verifyCharacterKey(
  key: string,
  fetcher: typeof fetch = fetch,
) {
  const fingerprint = createHash("sha256").update(key).digest("hex");
  ensure(
    await consumeBudget("connection-attempts", 100),
    "앱의 연결 확인 예산을 모두 사용했어요.",
    429,
  );
  let raw: unknown;
  try {
    raw = await nexonRequest(
      key,
      "/maplestory/v1/character/list",
      {},
      { fetcher },
    );
  } catch (error) {
    if (error instanceof DomainError && [401, 422].includes(error.status))
      throw new DomainError(
        "API 키가 올바르지 않거나 본인 캐릭터 조회 권한이 없어요.",
        400,
      );
    throw error;
  }
  const parsed = characterListResponse.safeParse(raw);
  ensure(
    parsed.success,
    "캐릭터 목록 응답이 공식 계약과 달라 연결을 완료하지 않았어요.",
    502,
  );
  const accountSignature = createHash("sha256")
    .update(
      parsed.data.account_list
        .map((a) => a.account_id)
        .sort()
        .join("\n"),
    )
    .digest("hex");
  const characters: Character[] = parsed.data.account_list
    .flatMap((a) => a.character_list)
    .map((c, index) => ({
      id: c.ocid,
      name: c.character_name,
      world: c.world_name,
      job: c.character_class,
      level: c.character_level,
      managed: false,
      favorite: false,
      order: index,
      avatar: 0,
    }));
  ensure(
    characters.length <= 100,
    "캐릭터가 100개를 초과해 지원 범위를 확인해야 해요.",
    422,
  );
  return { fingerprint, accountSignature, characters };
}
