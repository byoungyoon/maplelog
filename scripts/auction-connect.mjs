import { chromium } from "playwright";
import { mkdir, chmod } from "node:fs/promises";
import path from "node:path";

// Keep the auction session separate from the user's normal Chrome profile.
// Credentials are entered in Nexon's page, never passed as CLI arguments.
const profile = path.resolve(".local-secrets/auction-browser");
await mkdir(profile, { recursive: true, mode: 0o700 });
await chmod(profile, 0o700);

let context;
let poll;
try {
  context = await chromium.launchPersistentContext(profile, {
    channel: "chrome",
    headless: false,
  });
  context.once("close", () => clearInterval(poll));
  process.once("SIGINT", () => void context.close());
  process.once("SIGTERM", () => void context.close());
  const page = context.pages()[0] || (await context.newPage());
  console.log("전용 Chrome에서 로그인해 주세요. 창을 닫으면 연결 확인을 종료해요.");
  let previous = "";
  let checking = false;
  const check = async () => {
    if (checking || page.isClosed()) return;
    checking = true;
    try {
      const url = new URL(page.url());
      let status;
      if (url.hostname === "auction.maplestory.nexon.com") {
        const otpRequired = await page
          .getByText("OTP 미연동 계정입니다.", { exact: true })
          .isVisible();
        status = otpRequired
          ? "OTP 미연동으로 진입이 제한돼요. OTP 설정에서 직접 연동해 주세요."
          : "옥션 페이지가 열렸어요. 캐릭터 선택과 검색 가능 여부를 확인해 주세요.";
      } else if (url.hostname.endsWith(".nexon.com")) {
        status = "넥슨 로그인 또는 계정 설정 단계예요.";
      } else {
        status = "웹 옥션 페이지 연결을 기다리고 있어요.";
      }
      if (status !== previous) console.log(status);
      previous = status;
    } catch {
      // Navigation can destroy the document while checking; retry next tick.
    } finally {
      checking = false;
    }
  };
  await page.goto("https://auction.maplestory.nexon.com/character-select", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await check();
  poll = setInterval(() => void check(), 2000);
} catch {
  clearInterval(poll);
  await context?.close();
  console.error("Chrome 연결을 열지 못했어요. 같은 전용 브라우저가 열려 있다면 먼저 닫아 주세요.");
  process.exitCode = 1;
}
