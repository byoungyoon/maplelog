"use client";
import Link from "next/link";
import { ChevronRight, Check } from "lucide-react";
import { useBook } from "@/shared/_state/useBook";
import { useAppState } from "@/shared/_state/useAppState";
import { ReportHeader } from "@/shared/_area/ReportHeader.area";
import { ItemIcon } from "@/shared/_component/Visual";
import { Loading, ErrorState } from "@/shared/_component/Status";
import { RevenueCard } from "../_component/RevenueCard";
import DropSheet from "@/features/drops/_action/DropSheet.action";
export default function DashboardAction() {
  const q = useBook();
  const openSheet = useAppState((s) => s.openSheet);
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const { book, report } = q.data;
  return (
    <div className="home-essential">
      <h1 className="sr-only">내 보스 수익</h1>
      <ReportHeader title="" subtitle="" compact />
      <RevenueCard report={report} />
      <section className="pending-card home-pending">
        <div className="section-heading">
          <h2>
            드랍 확인{" "}
            <span className="count-badge">{report.pending.length}</span>
          </h2>
          <Link href="/bosses" className="text-button">
            보스 전체 <ChevronRight size={15} />
          </Link>
        </div>
        {report.pending.length ? (
          report.pending.slice(0, 5).map((c) => {
            const b = book.bosses.find((b) => b.id === c.bossId)!;
            const char = book.characters.find((x) => x.id === c.characterId)!;
            return (
              <button
                className="home-drop-row"
                key={c.id}
                onClick={() => openSheet(c.id)}
              >
                <ItemIcon image={b.image} kind={b.icon} />
                <span className="row-body">
                  <strong>
                    {b.name}
                    <span className="difficulty">
                      {c.difficulty ?? "확인 필요"}
                    </span>
                  </strong>
                  <span className="home-drop-caption">
                    {char.name}
                    {!c.party ? " · 분배 인원 미정" : ""}
                  </span>
                </span>
                <span className="home-row-action">
                  기록하기 <ChevronRight size={16} />
                </span>
              </button>
            );
          })
        ) : (
          <div className="home-empty">
            <Check size={20} />
            <span>
              {book.sync.lastSuccess
                ? "확인할 드랍이 없어요."
                : "새로고침으로 보스 기록을 불러오세요."}
            </span>
          </div>
        )}
        {report.pending.length > 5 && (
          <Link href="/bosses" className="home-more">
            나머지 {report.pending.length - 5}건 확인하기{" "}
            <ChevronRight size={15} />
          </Link>
        )}
      </section>
      <DropSheet />
    </div>
  );
}
