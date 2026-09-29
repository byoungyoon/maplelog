import { test, expect } from "@playwright/test";
import { characterListFixture } from "../fixtures/nexon";
const origin = "http://127.0.0.1:3100";
test.describe.configure({ mode: "serial" });
test("키 없이 모든 장부 URL과 내부 API 접근을 차단한다", async ({
  page,
  request,
}) => {
  for (const url of ["/", "/bosses", "/ledger", "/prices", "/settings"]) {
    await page.goto(url);
    await expect(page).toHaveURL(/\/setup$/);
    await expect(
      page.getByLabel("본인 Nexon API 키", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("데모", { exact: false })).toHaveCount(0);
  }
  for (const url of ["/api/book", "/api/export"])
    expect((await request.get(url)).status()).toBe(428);
  expect((await request.get("/api/book?mode=demo")).status()).toBe(404);
  expect(
    (
      await request.post("/api/command", {
        headers: { Origin: origin },
        data: {},
      })
    ).status(),
  ).toBe(428);
});
for (const width of [1440, 1024, 390, 360])
  test(`초기 연결 화면 ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("button", { name: "키 확인하고 시작하기" }),
    ).toBeDisabled();
  });
test("키 표시 전환·발급 안내·실패 상태", async ({ page }) => {
  await page.goto("/setup");
  const input = page.getByLabel("본인 Nexon API 키", { exact: true });
  await input.fill("test-only-input");
  await page.getByRole("button", { name: "API 키 표시" }).click();
  await expect(input).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "API 키 숨기기" }).click();
  await expect(input).toHaveAttribute("type", "password");
  await page.getByText("API 키는 어디서 발급하나요?").click();
  await expect(
    page.getByText("본인 계정으로 로그인해 주세요.", { exact: true }),
  ).toBeVisible();
  await page.route("**/api/connection/verify", (route) =>
    route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        error: { message: "API 키를 확인해 주세요." },
      }),
    }),
  );
  await page.getByRole("button", { name: "키 확인하고 시작하기" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "API 키를 확인" }),
  ).toBeVisible();
  await expect(input).toHaveValue("");
  await expect(page).toHaveURL(/\/setup$/);
});
test("클라이언트의 가짜 성공 응답만으로 장부에 진입할 수 없다", async ({
  page,
}) => {
  await page.goto("/setup");
  await page.route("**/api/connection/verify", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: { connected: true } }),
    }),
  );
  await page
    .getByLabel("본인 Nexon API 키", { exact: true })
    .fill("test-only-forged");
  await page.getByRole("button", { name: "키 확인하고 시작하기" }).click();
  await page.goto("/");
  await expect(page).toHaveURL(/\/setup$/);
});
test("서버 검증 완료 fixture → 보스 캐릭터 검색 → 장부 → 해제", async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  // Seed ONLY the isolated test server through the same connection service. No production bypass exists.
  process.env.DATA_DIR = process.env.MESOLOG_E2E_DATA_DIR;
  const { connectKey } = await import("../../src/server/connection");
  await connectKey("test-only-e2e-key", async () =>
    Response.json(characterListFixture),
  );
  await page.route("**/api/sync/request", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: { success: 0 } }),
    }),
  );
  await page.goto("/setup");
  await expect(page.getByText("캐릭터 선택", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "보스 화면 열기" }).click();
  await expect(page).toHaveURL(origin + "/bosses");
  await expect(page.getByRole("link", { name: "설정" })).toHaveCount(0);
  await page.getByLabel("캐릭터 검색").fill("테스트캐릭터");
  await expect(page.getByText("테스트캐릭터")).toBeVisible();
  await page.getByRole("button", { name: "보스 조회", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "테스트캐릭터" }),
  ).toBeVisible();
  const { readBook, writeBook } = await import("../../src/server/db");
  expect(readBook("live").characters[0]?.managed).toBe(false);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "전체 캐릭터 정산" }),
  ).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(origin + "/");
  const { mergeScheduler } = await import("../../src/server/nexon/normalize");
  const fixtureBook = readBook("live");
  mergeScheduler(fixtureBook, "test-ocid", {
    date: new Date().toISOString(),
    boss_contents: [
      {
        content_name: "루시드",
        difficulty: "hard",
        cycle: "bossWeekly",
        list_order_no: 1,
        registration_flag: "true",
        complete_flag: "true",
      },
    ],
    weekly_boss_clear_count: 1,
    weekly_boss_clear_limit_count: 12,
  });
  fixtureBook.characters.push({
    ...fixtureBook.characters[0],
    id: "test-ocid-two",
    name: "두번째캐릭터",
    managed: true,
    order: 1,
  });
  mergeScheduler(fixtureBook, "test-ocid-two", {
    date: new Date().toISOString(),
    boss_contents: [
      {
        content_name: "루시드",
        difficulty: "hard",
        cycle: "bossWeekly",
        list_order_no: 1,
        registration_flag: "true",
        complete_flag: "true",
      },
    ],
    weekly_boss_clear_count: 1,
    weekly_boss_clear_limit_count: 12,
  });
  fixtureBook.revision++;
  writeBook(fixtureBook);
  await page.reload();
  const cards = page.getByRole("article");
  await expect(cards).toHaveCount(1);
  const firstCard = page.getByRole("article", {
    name: "루시드 정산",
    exact: true,
  });
  await expect(firstCard.getByText("2명", { exact: true })).toBeVisible();
  await expect(firstCard.getByText(/1억 1,940만/)).toBeVisible();
  await firstCard.getByLabel("테스트캐릭터 정산 상세").click();
  const firstCharacter = firstCard.locator(".settlement-character").first();
  const belt = firstCharacter.getByRole("button", {
    name: "몽환의 벨트 획득",
    exact: true,
  });
  await expect(belt).toBeVisible();
  expect(
    await firstCharacter.locator(".quick-drop-toggle").count(),
  ).toBeLessThanOrEqual(5);
  await belt.click();
  await expect(belt).toHaveAttribute("aria-pressed", "true");
  await belt.click();
  await expect(belt).toHaveAttribute("aria-pressed", "false");
  await belt.click();
  await expect(belt).toHaveAttribute("aria-pressed", "true");
  await firstCharacter
    .getByRole("button", { name: "결정석 정산", exact: true })
    .click();
  await expect(
    firstCharacter.getByRole("button", { name: "정산 완료", exact: true }),
  ).toBeDisabled();
  const updated = readBook("live");
  expect(updated.completions[0].crystal).toBe("59700000");
  expect(updated.completions[0].party).toBe(1);
  expect(updated.settlements[0].net).toBe("59700000");
  expect(updated.drops[0].quantity).toBe(1);
  expect(updated.drops[0].unitPrice).toBe("3800000000");
  await page.getByRole("link", { name: "보스", exact: true }).click();
  await expect(page.getByLabel("캐릭터 선택", { exact: true })).toHaveCount(0);
  await expect(page.locator(".boss-record")).toHaveCount(0);
  await page.getByLabel("캐릭터 검색").fill("테스트캐릭터");
  await page.getByRole("button", { name: "상세보기" }).click();
  await expect(page.locator(".boss-record")).toHaveCount(1);
  await expect(page.locator(".boss-record .quick-settlement")).toHaveCount(0);
  await page.getByRole("button", { name: "다른 캐릭터 검색" }).click();
  await page.getByLabel("캐릭터 검색").fill("없는캐릭터");
  await expect(page.getByRole("button", { name: "상세보기" })).toHaveCount(0);
  await expect(page.locator(".boss-record")).toHaveCount(0);
  await page.getByLabel("캐릭터 검색").fill("두번째캐릭터");
  await page.getByRole("button", { name: "상세보기" }).click();
  await expect(page.locator(".boss-record")).toHaveCount(1);
  await page.getByRole("link", { name: "정산", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByLabel("캐릭터 선택", { exact: true })).toHaveCount(0);
  await firstCard.getByLabel("테스트캐릭터 정산 상세").click();
  await firstCharacter.getByRole("button", { name: "루시드 드랍 상세" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("결정석 분배 인원")).toHaveCount(0);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "기록 마치기", exact: true })
    .click();
  for (const width of [1440, 1024, 390, 360]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/", "/bosses", "/ledger", "/prices", "/settings"]) {
      await page.goto(path);
      await expect(
        page.getByRole("navigation", { name: "주 메뉴" }),
      ).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <= innerWidth &&
            document.documentElement.scrollHeight <= innerHeight,
        ),
      ).toBe(true);
      expect(
        await page.evaluate(() =>
          getComputedStyle(document.body).fontFamily.includes("Pretendard"),
        ),
      ).toBe(true);
      expect(
        await page
          .locator(".glass-workspace")
          .evaluate((el) => getComputedStyle(el).overflowY),
      ).toBe("auto");
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect
    .poll(() =>
      page.locator("video").evaluate((el: HTMLVideoElement) => el.readyState),
    )
    .toBeGreaterThan(1);
  await expect
    .poll(() =>
      page.locator("video").evaluate((el: HTMLVideoElement) => el.currentTime),
    )
    .toBeGreaterThan(0);
  expect(
    await page
      .locator("video")
      .evaluate((el: HTMLVideoElement) => el.playbackRate),
  ).toBe(1);
  expect(
    await page.locator("video").evaluate((el: HTMLVideoElement) => el.duration),
  ).toBeGreaterThan(40);
  await page.getByRole("button", { name: "배경 움직임 끄기" }).click();
  await expect
    .poll(() =>
      page.locator("video").evaluate((el: HTMLVideoElement) => el.paused),
    )
    .toBe(true);
  const exportResponse = await request.get("/api/export");
  expect(exportResponse.status()).toBe(200);
  expect(await exportResponse.text()).not.toContain("test-only-e2e-key");
  await page.goto("/settings");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "연결 해제", exact: true }).click();
  await expect(page).toHaveURL(/\/setup$/);
  await page.goto("/ledger");
  await expect(page).toHaveURL(/\/setup$/);
});
