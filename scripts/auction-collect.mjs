import { chromium } from "playwright";
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import path from "node:path";

const CHARACTER = "수민탁구몬함";
const WORLD = "베라";
const SOURCE = "https://auction.maplestory.nexon.com/buy";
const outputDir = path.resolve("data");
const day = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
const reportFile = (scope) =>
  path.join(outputDir, `auction-quick-${scope}-latest.json`);
const optioned = (card) =>
  /\(\+\d+\)|(?:^|\n)(?:레어|에픽|유니크|레전드리)(?:\n|$)/.test(card);
const sameItemName = (card, name) =>
  card.split("\n").some((line) => line.trim().replace(/\s+\(/g, "(") === name);

function counter(text) {
  const match = text.match(/검색 횟수\s*(\d+)\s*\/\s*100/);
  if (!match) throw new Error("경매장 검색 횟수를 확인할 수 없습니다.");
  return Number(match[1]);
}

function meso(text) {
  const match = text.replaceAll(",", "").trim().match(/^(?:(\d+)억\s*)?(?:(\d+)만\s*)?(\d+)?$/);
  if (!match || !match.slice(1).some(Boolean))
    throw new Error(`가격 형식을 읽을 수 없습니다: ${text}`);
  return (
    BigInt(match[1] || 0) * 100000000n +
    BigInt(match[2] || 0) * 10000n +
    BigInt(match[3] || 0)
  ).toString();
}

async function save(report) {
  await mkdir(outputDir, { recursive: true, mode: 0o700 });
  const body = `${JSON.stringify(report, null, 2)}\n`;
  const output = reportFile(report.scope);
  await writeFile(`${output}.tmp`, body, { mode: 0o600 });
  await rename(`${output}.tmp`, output);
  await writeFile(
    path.join(outputDir, `auction-quick-${report.scope}-${day(new Date(report.startedAt))}.json`),
    body,
    { mode: 0o600 },
  );
}

export async function collectAuctionListings(page, items, scope = "all", persist) {
  if (!page.url().startsWith(SOURCE)) throw new Error("경매장 구매 화면이 아닙니다.");
  await page.getByText("검색 횟수", { exact: true }).waitFor({ timeout: 30000 });
  if (!(await page.locator("body").innerText()).includes(CHARACTER))
    throw new Error("선택된 캐릭터가 다릅니다.");
  const checkbox = page.locator('input[type="checkbox"]').first();
  if (!(await checkbox.isChecked()))
    await page.getByText("현재 월드 아이템만", { exact: true }).click();
  if (!(await checkbox.isChecked())) throw new Error("현재 월드 필터를 설정하지 못했습니다.");

  let report = {
    source: SOURCE,
    world: WORLD,
    character: CHARACTER,
    currentWorldOnly: true,
    searchMode: "quick",
    scope,
    sort: "개당 낮은 가격순",
    startedAt: new Date().toISOString(),
    completedAt: null,
    items: [],
  };
  try {
    const previous = JSON.parse(await readFile(reportFile(scope), "utf8"));
    if (
      previous.searchMode === "quick" &&
      previous.scope === scope &&
      previous.world === WORLD &&
      day(new Date(previous.startedAt)) === day() &&
      previous.items.every((entry, index) =>
        entry.id === items[index]?.id && entry.name === items[index]?.name
      )
    ) report = previous;
  } catch {
    // A missing or invalid earlier report starts a fresh collection.
  }
  if (report.completedAt && report.items.length === items.length) return report;
  await save(report);
  if (persist) await persist(report);

  let lastSearchAt = 0;
  for (let index = report.items.length; index < items.length; index++) {
    const item = items[index];
    const query = item.name.includes("(") ? ` ${item.name}` : item.name;
    const before = counter(await page.locator("body").innerText());
    if (before >= 100) throw new Error("오늘의 검색 횟수를 모두 사용했습니다.");
    const input = page.locator('input[role="combobox"]').first();
    await input.fill(query);
    for (let attempt = 0; attempt < 3; attempt++) {
      const pause = 5000 - (Date.now() - lastSearchAt);
      if (pause > 0) await page.waitForTimeout(pause);
      await input.press("Enter");
      lastSearchAt = Date.now();
      try {
        await page.waitForFunction(
          (previous) => {
            const match = document.body.innerText.match(/검색 횟수\s*(\d+)\s*\/\s*100/);
            return match && Number(match[1]) > previous;
          },
          before,
          { timeout: 6000 },
        );
        break;
      } catch {
        if (attempt === 2) throw new Error(`${item.name}: 빠른 검색 요청이 처리되지 않았습니다.`);
      }
    }
    const body = await page.locator("body").innerText();
    const after = counter(body);
    if (!body.includes(`“ ${item.name} ”`) && !body.includes(`“ ${query} ”`))
      throw new Error(`${item.name}: 검색 결과 제목이 다릅니다.`);
    const header = body.match(/(?:^|\n)검색 결과\s*([\d,]+)건/);
    if (!header) throw new Error(`${item.name}: 검색 결과 건수를 확인할 수 없습니다.`);
    const listingCount = Number(header[1].replaceAll(",", ""));
    if (!body.includes("개당 낮은 가격순"))
      throw new Error(`${item.name}: 가격 오름차순을 확인할 수 없습니다.`);

    let status = "zero-results";
    let firstCard = null;
    let lowestUnitPrice = null;
    if (listingCount > 0) {
      const cards = await page.locator('div[class*="h-[84px]"]').allInnerTexts();
      const exactCards = cards.filter((card) => sameItemName(card, item.name));
      const plain = exactCards.find((card) => !optioned(card));
      firstCard = (plain || exactCards[0] || null)?.trim() || null;
      status = plain ? "listed" : exactCards.length ? "optioned" : "no-exact-first-page";
      if (plain) {
        const unit = firstCard.match(/개당\s*\n\s*([\d억만 ,]+)\s*\n\s*메소/)
          || firstCard.match(/(?:^|\n)([\d억만 ,]+)\s*\n\s*메소(?:\n|$)/);
        if (!unit) throw new Error(`${item.name}: 첫 적합 매물의 개당 가격을 읽을 수 없습니다.`);
        lowestUnitPrice = meso(unit[1]);
      }
    }
    report.items.push({
      id: item.id,
      name: item.name,
      query,
      status,
      listingCount,
      lowestUnitPrice,
      firstCard,
      observedAt: new Date().toISOString(),
      searchCounter: after,
    });
    await save(report);
    if (persist) await persist(report);
    console.log(`${index + 1}/${items.length} ${item.name}: ${status}, ${lowestUnitPrice ?? "가격 없음"} (${after}/100)`);
  }
  report.completedAt = new Date().toISOString();
  await save(report);
  if (persist) await persist(report);
  return report;
}

async function main() {
  const scope = process.argv.includes("--parentheses-only")
    ? "parentheses"
    : process.argv.includes("--missing-only") ? "missing" : "all";
  process.loadEnvFile(".env");
  if (!process.env.NEXON_AUCTION_ID || !process.env.NEXON_AUCTION_PASSWORD)
    throw new Error(".env에 경매장 로그인 정보를 입력해 주세요.");
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    readFileSync(path.resolve(".local-secrets/firebase-service-account.json"), "utf8");
  const firestore = getFirestore(initializeApp({
    credential: cert(JSON.parse(key)),
    projectId: process.env.FIREBASE_PROJECT_ID,
  }));
  const snapshot = await firestore.collection("books").doc("live").get();
  if (!snapshot.exists) throw new Error("Firestore 장부가 없습니다.");
  const payload = snapshot.get("payloadGzip")
    ? gunzipSync(Buffer.from(snapshot.get("payloadGzip"), "base64")).toString("utf8")
    : snapshot.get("payload");
  const book = JSON.parse(payload);
  const items = book.items
    .filter((item) => scope === "all" ||
      (item.price === null && (scope !== "parentheses" || item.name.includes("("))))
    .map(({ id, name }) => ({ id, name }));
  try {
    const previous = JSON.parse(await readFile(reportFile(scope), "utf8"));
    if (
      previous.completedAt && previous.searchMode === "quick" &&
      day(new Date(previous.startedAt)) === day() &&
      previous.items.length === items.length &&
      previous.items.every((entry, index) =>
        entry.id === items[index].id && entry.name === items[index].name
      )
    ) {
      console.log(`오늘 빠른 검색 완료: ${previous.items.length}개 항목`);
      return;
    }
  } catch {
    // No completed same-day report is available.
  }
  const context = await chromium.launchPersistentContext(
    path.resolve(".local-secrets/auction-browser"),
    { channel: "chrome", headless: false },
  );
  try {
    const page = context.pages()[0] || (await context.newPage());
    await page.goto("https://auction.maplestory.nexon.com/character-select", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(2500);
    if (page.url().includes("nxlogin.nexon.com")) {
      await page.getByPlaceholder("넥슨ID (아이디 또는 이메일)").fill(process.env.NEXON_AUCTION_ID);
      await page.getByPlaceholder("비밀번호").fill(process.env.NEXON_AUCTION_PASSWORD);
      await page.getByRole("button", { name: /넥슨 ID 로그인/ }).click();
    }
    await page.getByText(CHARACTER, { exact: true }).waitFor({ timeout: 30000 });
    await page.getByText(CHARACTER, { exact: true }).click();
    await page.waitForURL(SOURCE, { timeout: 30000 });
    await collectAuctionListings(page, items, scope, async (report) => {
      await firestore.collection("auction-reports")
        .doc(`${scope}-${day(new Date(report.startedAt))}`).set(report);
    });
  } finally {
    await context.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename))
  await main();
