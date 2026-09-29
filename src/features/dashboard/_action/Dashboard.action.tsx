"use client";
import { Check } from "lucide-react";
import { useBook } from "@/shared/_state/useBook";
import { ReportHeader } from "@/shared/_area/ReportHeader.area";
import { ItemIcon } from "@/shared/_component/Visual";
import { Loading, ErrorState } from "@/shared/_component/Status";
import { RevenueCard } from "../_component/RevenueCard";
import DropSheet from "@/features/drops/_action/DropSheet.action";
import { QuickSettlement } from "@/features/drops/_action/QuickSettlement.action";
export default function DashboardAction() {
  const q = useBook();
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const { book, report } = q.data;
  const completions = report.selected.filter((c) => !c.excluded);
  return (
    <div className="home-essential">
      <h1 className="sr-only">전체 캐릭터 정산</h1>
      <ReportHeader title="" subtitle="" compact />
      <RevenueCard report={report} />
      <div className="section-heading settlement-heading">
        <h2>
          보스 정산 <span className="count-badge">{completions.length}</span>
        </h2>
        <span>전체 캐릭터</span>
      </div>
      <section className="settlement-grid" aria-label="전체 캐릭터 보스 정산">
        {completions.map((c) => {
          const boss = book.bosses.find((b) => b.id === c.bossId)!;
          const character = book.characters.find(
            (char) => char.id === c.characterId,
          )!;
          return (
            <article
              className="panel settlement-card"
              key={c.id}
              aria-label={`${character.name} ${boss.name} 정산`}
            >
              <div className="settlement-card-heading">
                <ItemIcon image={boss.image} kind={boss.icon} />
                <div>
                  <h3>
                    {boss.name}{" "}
                    <span className="difficulty">
                      {c.difficulty ?? "확인 필요"}
                    </span>
                  </h3>
                  <p>{character.name}</p>
                </div>
              </div>
              <QuickSettlement book={book} completion={c} />
            </article>
          );
        })}
      </section>
      {!completions.length && (
        <div className="panel home-empty">
          <Check size={20} />
          <span>
            {book.sync.lastSuccess
              ? "이 기간에 정산할 완료 보스가 없어요."
              : "새로고침으로 보스 기록을 불러오세요."}
          </span>
        </div>
      )}
      <DropSheet />
    </div>
  );
}
