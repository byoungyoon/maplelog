"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Wallet, Swords, ChartNoAxesCombined, X } from "lucide-react";
import { NatureBackground } from "../_component/NatureBackground";
import { useAppState } from "../_state/useAppState";
const nav = [
  { href: "/", name: "정산", icon: Wallet },
  { href: "/bosses", name: "보스", icon: Swords },
  { href: "/prices", name: "시세", icon: ChartNoAxesCombined },
];
export default function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const previousPath = useRef(path);
  useEffect(() => {
    const previous = previousPath.current;
    previousPath.current = path;
    if (previous.startsWith("/bosses") && path.startsWith("/bosses")) return;
    scrollRef.current?.scrollTo({ top: 0 });
  }, [path]);
  const { toast, notify, ambientMotion, toggleAmbientMotion } = useAppState();
  const simple = path === "/setup" || path === "/login";
  const entering = useAppState((s) => s.entering);
  const finishEntrance = useAppState((s) => s.finishEntrance);
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    if (simple || !ambientMotion || reduced.matches) {
      if (useAppState.getState().entering) finishEntrance();
      return;
    }
    if (useAppState.getState().entryPlayed) return;
    useAppState.getState().startEntrance();
    const timer = setTimeout(finishEntrance, 2600);
    const onReduce = () => {
      if (reduced.matches) finishEntrance();
    };
    reduced.addEventListener("change", onReduce);
    return () => {
      clearTimeout(timer);
      reduced.removeEventListener("change", onReduce);
    };
  }, [simple, ambientMotion, finishEntrance]);
  return (
    <>
      <NatureBackground />
      <a href="#main" className="skip-link">
        본문으로 건너뛰기
      </a>
      <div
        className={
          simple ? "simple-shell" : `app-frame ${entering ? "is-entering" : ""}`
        }
      >
        {!simple && (
          <nav className="frame-nav" aria-label="주 메뉴">
            <Link href="/" className="frame-brand" aria-label="메소로그 정산">
              <Image
                src="/brand/icon-sage.png"
                alt=""
                width={38}
                height={38}
                priority
              />
              <span>메소로그</span>
            </Link>
            <div className="frame-links">
              {nav.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className={
                    path === n.href ||
                    (n.href !== "/" && path.startsWith(n.href + "/"))
                      ? "active"
                      : ""
                  }
                  aria-current={
                    path === n.href ||
                    (n.href !== "/" && path.startsWith(n.href + "/"))
                      ? "page"
                      : undefined
                  }
                >
                  <n.icon size={16} strokeWidth={1.8} />
                  <span>{n.name}</span>
                </Link>
              ))}
            </div>
          </nav>
        )}
        <div ref={scrollRef} className={simple ? "" : "glass-workspace"}>
          <main id="main" tabIndex={-1}>
            {children}
          </main>
          <footer className="main-footer">
            <span>차곡차곡, 나의 메소로그</span>
            <button
              className="ambient-toggle"
              aria-pressed={ambientMotion}
              onClick={toggleAmbientMotion}
            >
              {ambientMotion ? "배경 움직임 끄기" : "배경 움직임 켜기"}
            </button>
            <span>Data based on NEXON Open API</span>
          </footer>
        </div>
      </div>
      {entering && (
        <button className="intro-skip" onClick={finishEntrance}>
          입장 효과 건너뛰기
        </button>
      )}
      {toast && (
        <div className="toast" role="status" aria-live="polite">
          <span>{toast}</span>
          <button aria-label="알림 닫기" onClick={() => notify(null)}>
            <X size={18} />
          </button>
        </div>
      )}
    </>
  );
}
