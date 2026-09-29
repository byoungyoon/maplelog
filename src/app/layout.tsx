import type { Metadata } from "next";
import "pretendard/dist/web/variable/pretendardvariable.css";
import "./globals.css";
import Providers from "@/shared/_component/Providers";
import AppShell from "@/shared/_area/AppShell.area";
export const metadata: Metadata = {
  title: "메소로그 — 나의 보스 수익 장부",
  description:
    "보스 완료부터 드랍 기록과 정산까지, 차곡차곡 모으는 나의 메이플 가계부.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
