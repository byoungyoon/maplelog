"use client";
import { visiblePriceItems } from "../_lib/visiblePriceItems";
import { useState } from "react";
import { Search, Info } from "lucide-react";
import { useBook } from "@/shared/_state/useBook";
import { useCommand } from "@/shared/_action/useCommand";
import { Loading, ErrorState, Empty } from "@/shared/_component/Status";
import { ItemIcon } from "@/shared/_component/Visual";
import { formatMeso } from "@/domain/money";

export default function PricesAction() {
  const q = useBook();
  const cmd = useCommand();
  const [search, setSearch] = useState("");
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const { book } = q.data;
  const items = visiblePriceItems(book.items, search);
  const latestAuction = book.items
    .filter((item) => item.source === "auction")
    .map((item) => item.observedAt)
    .sort()
    .at(-1);

  return (
    <>
      <div className="notice">
        <Info size={17} />
        <span>
          베라 경매장 시세 · 정기 갱신 목표: 매일 오전 10시 (한국 시간) · 최근 수집:{" "}
          {latestAuction
            ? new Date(latestAuction).toLocaleString("ko-KR", {
                timeZone: "Asia/Seoul",
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "아직 없음"}
        </span>
      </div>
      <label className="search-input">
        <Search size={18} />
        <input
          placeholder="아이템 이름 검색"
          aria-label="아이템 이름 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <section className="panel prices-list">
        {items.map((item) => {
          const stale =
            new Date(item.observedAt).getTime() <
            q.data.asOf - book.settings.staleHours * 3600000;
          return (
            <div className="price-row" key={item.id}>
              <ItemIcon image={item.image} kind={item.icon} />
              <div className="row-body">
                <strong>{item.name}</strong>
                <p>{item.market} · {item.variant}</p>
                <span className="price-meta">
                  {item.source === "auction"
                    ? item.price === null
                      ? "경매장 가격 미정"
                      : "경매장 최저 등록가"
                    : item.price === null
                      ? "가격 미정"
                      : "이전 참고가"}{" "}
                  ·{" "}
                  {new Date(item.observedAt).toLocaleString("ko-KR", {
                    timeZone: "Asia/Seoul",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="price-value">
                <strong>
                  {formatMeso(item.price)}
                  {item.price && <small> 메소</small>}
                </strong>
                <span className={`price-state ${stale ? "stale" : ""}`}>
                  {item.price === null
                    ? "미정"
                    : stale
                      ? "오래된 기준가"
                      : "기준가 있음"}
                </span>
              </div>
            </div>
          );
        })}
        {!items.length && (
          <Empty
            title={search ? "검색 결과가 없어요" : "표시할 아이템이 없어요"}
            detail={
              search
                ? "다른 아이템 이름으로 검색해 주세요."
                : "가격이 확인된 아이템이 없어요."
            }
          />
        )}
      </section>
      <details className="audit-details">
        <summary>결정석 기준가 관리</summary>
        <p className="muted-note">
          확인 2026.09.29 · 검은 마법사 변경가는 10.01 적용
        </p>
        <p className="muted-note">
          9월 17일 가격표를 적용했어요. 직접 수정한 기준가는 새 완료 기록부터
          적용되며, 기존 기록은 드랍 기록의 조건 확인에서 반영할 수 있어요.
        </p>
        {book.bosses.map((boss) => (
          <form
            key={boss.id}
            className="price-row"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              cmd.mutate({
                type: "crystal-price",
                bossId: boss.id,
                price: String(form.get("price")) || null,
              });
            }}
          >
            <div className="row-body">
              <strong>{boss.name}</strong>
              <p>
                {boss.difficulty} ·{" "}
                {boss.cycle === "weekly"
                  ? "주간"
                  : boss.cycle === "daily"
                    ? "일간"
                    : "월간"}
              </p>
            </div>
            <label>
              <span className="sr-only">
                {boss.name} {boss.difficulty} 결정석 기준가
              </span>
              <input
                key={boss.crystal}
                name="price"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="기준가 미정"
                defaultValue={boss.crystal ?? ""}
                style={{ width: 150 }}
              />
            </label>
            <button className="button soft" disabled={cmd.isPending}>
              저장
            </button>
          </form>
        ))}
      </details>
    </>
  );
}
