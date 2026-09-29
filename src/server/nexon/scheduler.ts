import { z } from "zod";
import { ensure } from "@/domain/model";
import { nexonRequest } from "./client";
export const schedulerResponse = z.object({
  date: z.string(),
  boss_contents: z.array(
    z.object({
      content_name: z.string(),
      difficulty: z.string(),
      cycle: z.string(),
      list_order_no: z.number().int(),
      registration_flag: z.enum(["true", "false"]),
      complete_flag: z.enum(["true", "false"]),
    }),
  ),
  weekly_boss_clear_count: z.number().int(),
  weekly_boss_clear_limit_count: z.number().int(),
});
export async function fetchScheduler(
  key: string,
  ocid: string,
  options: {
    generation?: number;
    budget?: number;
    date?: string;
    fetcher?: typeof fetch;
  } = {},
) {
  const raw = await nexonRequest(
    key,
    "/maplestory/v1/scheduler/character-state",
    { ocid, ...(options.date ? { date: options.date } : {}) },
    options,
  );
  const parsed = schedulerResponse.safeParse(raw);
  ensure(
    parsed.success,
    "스케줄러 응답 형식을 확인해야 해요. 기존 기록을 유지했어요.",
    502,
  );
  return parsed.data;
}
export async function fetchCharacterImage(
  key: string,
  ocid: string,
  options: {
    generation?: number;
    budget?: number;
    fetcher?: typeof fetch;
  } = {},
) {
  const raw = await nexonRequest(
    key,
    "/maplestory/v1/character/basic",
    { ocid },
    options,
  );
  const parsed = z
    .object({
      character_image: z.string().url().nullable(),
      character_level: z.number().int().nullable(),
      character_class: z.string().nullable(),
    })
    .safeParse(raw);
  ensure(parsed.success, "캐릭터 기본 정보 응답을 확인할 수 없어요.", 502);
  const image = parsed.data.character_image;
  return image?.startsWith("https://open.api.nexon.com/static/maplestory/")
    ? image
    : null;
}
