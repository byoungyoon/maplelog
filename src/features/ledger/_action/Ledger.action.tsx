"use client";
import { useState } from "react";
import { Download, ReceiptText, ChevronRight } from "lucide-react";
import { useBook } from "@/shared/_state/useBook";
import { useAppState } from "@/shared/_state/useAppState";
import { ReportHeader } from "@/shared/_area/ReportHeader.area";
import { Loading, ErrorState, Empty } from "@/shared/_component/Status";
import { ItemIcon } from "@/shared/_component/Visual";
import DropSheet from "@/features/drops/_action/DropSheet.action";
import { formatMeso } from "@/domain/money";
export default function LedgerAction() {
  const q = useBook();
  const openSheet = useAppState((s) => s.openSheet);
  const [filter, setFilter] = useState("전체");
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const { book, report } = q.data;
  const rows = report.rows.filter(
    (row) =>
      !row.excluded &&
      (filter === "전체" ||
        (filter === "결정석" && row.kind === "crystal") ||
        (filter === "드랍" && row.kind === "drop")),
  );
  return (
    <>
      <ReportHeader
        title="보스 기록"
        subtitle="잡은 보스와 획득한 드랍을 모아 보여요."
      />
      <div className="ledger-summary">
        <ReceiptText size={24} />
        <div>
          <span>잡은 보스 수익</span>
          <strong>
            {formatMeso(report.summary.total)}
            <small> 메소</small>
          </strong>
        </div>
        <a
          href="/api/export?format=csv"
          download="maplelog.csv"
          className="button"
        >
          <Download size={16} />
          CSV 내보내기
        </a>
      </div>
      <div className="filter-row">
        {["전체", "결정석", "드랍"].map((value) => (
          <button
            key={value}
            className={`chip ${filter === value ? "active" : ""}`}
            onClick={() => setFilter(value)}
          >
            {value}
          </button>
        ))}
      </div>
      <section className="panel ledger-list">
        {rows.map((row) => {
          const character = book.characters.find(
            (c) => c.id === row.characterId,
          )!;
          const boss = book.bosses.find((b) => b.id === row.bossId)!;
          const drop =
            row.kind === "drop"
              ? book.drops.find((d) => d.id === row.id)
              : undefined;
          const item = drop
            ? book.items.find((i) => i.id === drop.itemId)
            : undefined;
          return (
            <button
              className="ledger-row"
              key={row.id}
              onClick={() => openSheet(row.completionId)}
            >
              <ItemIcon
                image={item?.image ?? boss.image}
                kind={item?.icon ?? boss.icon}
                small
              />
              <div className="row-body">
                <strong>
                  {row.name}
                  {row.quantity > 1 && (
                    <span className="quantity-label">{row.quantity}개</span>
                  )}
                </strong>
                <p>
                  {character.name} · {boss.name}
                </p>
              </div>
              <div className="ledger-amount">
                <strong>
                  {row.unknown ? "가격 미정" : `${formatMeso(row.total)} 메소`}
                </strong>
                <span>
                  {row.kind === "crystal" ? "보스 완료" : "획득한 드랍"}
                </span>
              </div>
              <ChevronRight size={17} />
            </button>
          );
        })}
        {!rows.length && (
          <Empty
            title="이 기간의 기록이 없어요"
            detail="보스를 잡고 드랍을 선택하면 여기에 모여요."
          />
        )}
      </section>
      <DropSheet />
    </>
  );
}
