import { calculateBossCuts, type BossAnalysis } from "@/domain/boss-cut";
import { DomainError, ensure } from "@/domain/model";
import { credentialForRequest, credentialIsCurrent } from "@/server/connection";
import { acquireLease, analysisRef, consumeBudget, readBook, setLease } from "@/server/db";
import catalogue from "@/data/scouter-boss-cuts.json";

let browserHeader: { value: string; expires: number } | undefined;
// This is the site's public browser-client header, not an account credential.
// Discover it from the public client bundle instead of embedding it in the repo.
async function publicBrowserHeader(fetcher: typeof fetch) {
  if (browserHeader && browserHeader.expires > Date.now())
    return browserHeader.value;
  const page = await fetcher("https://maplescouter.com/ko/result", {
    signal: AbortSignal.timeout(10000),
    redirect: "error",
  });
  ensure(page.ok, "환산 사이트에 연결하지 못했어요.", 502);
  const html = await page.text();
  ensure(html.length < 4000000, "환산 응답 크기를 확인해야 해요.", 502);
  const bundle = html.match(
    /src="(\/_next\/static\/chunks\/8153-[a-z0-9]+\.js)"/i,
  )?.[1];
  ensure(bundle, "환산 사이트의 연결 형식이 변경됐어요.", 502);
  const script = await fetcher(`https://maplescouter.com${bundle}`, {
    signal: AbortSignal.timeout(10000),
    redirect: "error",
  });
  ensure(script.ok, "환산 연결 정보를 가져오지 못했어요.", 502);
  const source = await script.text();
  ensure(source.length < 4000000, "환산 연결 정보 크기를 확인해야 해요.", 502);
  const value = source.match(/"api-key":"([a-f0-9-]{36})"/i)?.[1];
  ensure(value, "환산 사이트의 연결 형식이 변경됐어요.", 502);
  browserHeader = { value, expires: Date.now() + 3600000 };
  return value;
}

export async function analyzeCharacter(
  characterId: string,
  fetcher: typeof fetch = fetch,
): Promise<BossAnalysis> {
  const credential = await credentialForRequest();
  const character = (await readBook("live")).characters.find(
    (c) => c.id === characterId,
  );
  ensure(character, "연결된 캐릭터를 찾지 못했어요.", 404);
  const cached = (await analysisRef(characterId).get()).data() as
    { checkedAt: number; payload: string } | undefined;
  if (cached && Date.now() - cached.checkedAt < 600000) {
    const data = JSON.parse(cached.payload) as BossAnalysis;
    if (
      data.version === catalogue.version &&
      data.name === character.name &&
      data.world === character.world
    )
      return data;
  }
  const lease = `boss-analysis:${characterId}`;
  const acquired = await acquireLease(lease, 60000);
  ensure(
    acquired,
    "환산 조회가 진행 중이거나 잠시 대기 중이에요. 잠시 후 다시 시도해 주세요.",
    409,
  );
  try {
    ensure(
      await consumeBudget("scouter-boss-analysis", 100),
      "오늘의 환산 조회 예산을 모두 사용했어요.",
      429,
    );
    const clientHeader = await publicBrowserHeader(fetcher);
    const url = new URL("https://api.maplescouter.com/api/id");
    url.search = new URLSearchParams({
      name: character.name,
      region: "kms",
      preset: "00000",
    }).toString();
    const response = await fetcher(url, {
      headers: { "api-key": clientHeader, Accept: "application/json" },
      signal: AbortSignal.timeout(20000),
      redirect: "error",
      cache: "no-store",
    });
    if ([401, 403, 500].includes(response.status)) browserHeader = undefined;
    ensure(
      response.ok,
      [429, 430].includes(response.status)
        ? "환산 사이트의 조회 제한에 도달했어요. 잠시 후 다시 시도해 주세요."
        : "환산 데이터를 가져오지 못했어요. 원본 사이트에서 캐릭터를 확인해 주세요.",
      [429, 430].includes(response.status) ? 429 : 502,
    );
    const data = calculateBossCuts(
      await response.json(),
      character.name,
      character.world,
    );
    ensure(await credentialIsCurrent(credential.generation),
      "키 연결이 변경되어 환산 결과를 저장하지 않았어요.", 409);
    ensure(
          (await readBook("live")).characters.some(
            (c) =>
              c.id === characterId &&
              c.name === data.name &&
              c.world === data.world,
          ),
          "캐릭터 정보가 변경되어 다시 조회해야 해요.",
          409,
        );
    await analysisRef(characterId).set({ checkedAt: Date.now(), payload: JSON.stringify(data) });
    return data;
  } catch (error) {
    if (error instanceof DomainError) throw error;
    throw new DomainError(
      "환산 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.",
      502,
    );
  } finally {
    await setLease(lease, Date.now() + 30000);
  }
}
