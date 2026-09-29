import { createHash } from "node:crypto";
import { DomainError, ensure } from "@/domain/model";
import { consumeBudget, usageCount, sqlite } from "@/server/db";
export type NexonPath =
  | "/maplestory/v1/character/list"
  | "/maplestory/v1/scheduler/character-state"
  | "/maplestory/v1/character/basic";
export async function nexonRequest(
  key: string,
  path: NexonPath,
  query: Record<string, string> = {},
  options: {
    fetcher?: typeof fetch;
    budget?: number;
    generation?: number;
  } = {},
): Promise<unknown> {
  const fingerprint = createHash("sha256").update(key).digest("hex");
  const provider = `nexon:${fingerprint}`;
  const budget = options.budget ?? 800;
  const blocked = sqlite
    .prepare("SELECT until_at FROM leases WHERE name=?")
    .get(provider) as { until_at: number } | undefined;
  ensure(
    !blocked || blocked.until_at <= Date.now(),
    "넥슨 호출 제한 대기 중이에요.",
    429,
  );
  let reserved = false;
  for (let attempt = 0; attempt < 6; attempt++) {
    reserved = consumeBudget(provider, budget);
    if (reserved) break;
    ensure(
      usageCount(provider) < budget,
      "앱의 24시간 호출 예산을 모두 사용했어요.",
      429,
    );
    await new Promise((r) => setTimeout(r, 220));
  }
  ensure(reserved, "초당 호출 제한으로 잠시 대기해 주세요.", 429);
  const url = new URL(path, "https://open.api.nexon.com");
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const controller = new AbortController();
  const timer =
    options.generation === undefined
      ? undefined
      : setInterval(() => {
          const row = sqlite
            .prepare("SELECT generation FROM credentials WHERE id=1")
            .get() as { generation: number } | undefined;
          if (row?.generation !== options.generation) controller.abort();
        }, 100);
  let response: Response;
  try {
    response = await (options.fetcher ?? fetch)(url.toString(), {
      headers: { "x-nxopen-api-key": key },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
    });
  } catch {
    throw new DomainError(
      controller.signal.aborted
        ? "키 연결이 바뀌어 조회를 중단했어요."
        : "넥슨에 연결하지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.",
      502,
    );
  } finally {
    if (timer) clearInterval(timer);
  }
  if (response.status === 429) {
    const raw = response.headers.get("retry-after");
    const seconds = raw ? Number(raw) : NaN;
    const until = Number.isFinite(seconds)
      ? Date.now() + Math.max(seconds, 60) * 1000
      : Math.max(Date.now() + 60000, Date.parse(raw || "") || 0);
    sqlite
      .prepare(
        "INSERT INTO leases(name,until_at) VALUES(?,?) ON CONFLICT(name) DO UPDATE SET until_at=excluded.until_at",
      )
      .run(provider, until);
    throw new DomainError(
      "넥슨 호출 한도에 도달했어요. 잠시 후 다시 시도해 주세요.",
      429,
    );
  }
  if (response.status === 401 || response.status === 403)
    throw new DomainError(
      "API 키가 올바르지 않거나 본인 캐릭터 조회 권한이 없어요.",
      401,
    );
  if (response.status === 400)
    throw new DomainError(
      "요청한 날짜의 캐릭터 데이터가 없거나 조회 조건을 확인해야 해요.",
      422,
    );
  ensure(response.ok, "넥슨 점검 또는 응답 지연이에요.", 502);
  try {
    return await response.json();
  } catch {
    throw new DomainError("넥슨 응답 형식을 확인할 수 없어요.", 502);
  }
}
