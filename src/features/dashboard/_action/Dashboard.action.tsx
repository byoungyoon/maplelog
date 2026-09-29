"use client";
import { useEffect, useRef } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useBook } from "@/shared/_state/useBook";
import { useAppState } from "@/shared/_state/useAppState";
import { api } from "@/shared/_lib/api";
import { ReportHeader } from "@/shared/_area/ReportHeader.area";
import { ItemIcon } from "@/shared/_component/Visual";
import { Loading, ErrorState } from "@/shared/_component/Status";
import { RevenueCard } from "../_component/RevenueCard";
import DropSheet from "@/features/drops/_action/DropSheet.action";
import { QuickSettlement } from "@/features/drops/_action/QuickSettlement.action";
import { bossEarnings, summarize } from "@/domain/revenue";
import { formatMeso } from "@/domain/money";
export default function DashboardAction() {
  const q = useBook();
  const refetch = q.refetch;
  const requestedFullSync = useRef(false);
  const { notify } = useAppState();
  const missingSync = q.data?.book.characters.some(
    (character) =>
      !q.data?.book.sync.characters?.some(
        (state) => state.characterId === character.id,
      ),
  );
  useEffect(() => {
    if (!missingSync || requestedFullSync.current) return;
    requestedFullSync.current = true;
    void api("sync/request", {})
      .then(() => refetch())
      .catch((error) =>
        notify(error instanceof Error ? error.message : "전체 보스 조회에 실패했어요."),
      );
  }, [missingSync, notify, refetch]);
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const { book, report } = q.data;
  const completions = report.selected.filter((c) => !c.excluded);
  const groups = bossEarnings(book, report.selected);
  return (
    <div className="home-essential">
      <h1 className="sr-only">전체 캐릭터 정산</h1>
      <ReportHeader title="" subtitle="" compact />
      {missingSync && (
        <div className="notice">
          전체 캐릭터 보스 조회 중 · {book.sync.characters?.length ?? 0}/{book.characters.length}명 확인
        </div>
      )}
      <RevenueCard report={report} />
      <div className="section-heading settlement-heading">
        <h2>
          보스 정산 <span className="count-badge">{groups.length}</span>
        </h2>
        <span>전체 캐릭터 · 완료 {completions.length}건</span>
      </div>
      <section className="settlement-grid" aria-label="전체 캐릭터 보스 정산">
        {groups.map((group) => (
          <article
            className="panel settlement-card"
            key={group.group}
            aria-label={`${group.boss.name} 정산`}
          >
            <div className="settlement-card-heading">
              <ItemIcon image={group.boss.image} kind={group.boss.icon} />
              <div>
                <h3>{group.boss.name}</h3>
                <p>{group.difficulties.join(" · ")}</p>
              </div>
            </div>
            <div className="settlement-boss-summary">
              <div>
                <span>완료 캐릭터</span>
                <strong>{group.characterCount}명</strong>
              </div>
              <div>
                <span>완료 수익 · 예상 포함</span>
                <strong>{formatMeso(group.total)} <small>메소</small></strong>
              </div>
            </div>
            {group.unknown > 0 && (
              <p className="settlement-boss-note">가격 미정 {group.unknown}건 제외</p>
            )}
            <div className="settlement-characters">
              {group.records.map((completion) => {
                const character = book.characters.find(
                  (item) => item.id === completion.characterId,
                )!;
                const amount = summarize(
                  report.rows.filter((row) => row.completionId === completion.id),
                ).total;
                return (
                  <details className="settlement-character" key={completion.id}>
                    <summary aria-label={`${character.name} 정산 상세`}>
                      <span>{character.name}</span>
                      <small>{completion.difficulty ?? "확인 필요"}</small>
                      <strong>{formatMeso(amount)} <small>메소</small></strong>
                      <ChevronDown size={16} aria-hidden="true" />
                    </summary>
                    <QuickSettlement book={book} completion={completion} />
                  </details>
                );
              })}
            </div>
          </article>
        ))}
      </section>
      {!completions.length && (
        <div className="panel home-empty">
          <Check size={20} />
          <span>
            {book.sync.lastSuccess
              ? "이 기간에 정산할 완료 보스가 없어요."
              : "보스에서 캐릭터를 검색해 조회하면 전체 정산에 모아 보여요."}
          </span>
        </div>
      )}
      <DropSheet />
    </div>
  );
}
