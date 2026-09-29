"use client";
import { useState } from "react";
import { Check, MoreHorizontal, Search } from "lucide-react";
import { useBook } from "@/shared/_state/useBook";
import { useAppState } from "@/shared/_state/useAppState";
import { useCommand } from "@/shared/_action/useCommand";
import { ReportHeader } from "@/shared/_area/ReportHeader.area";
import { ItemIcon } from "@/shared/_component/Visual";
import { Loading, ErrorState, Empty } from "@/shared/_component/Status";
import { formatMeso } from "@/domain/money";
import { QuickSettlement } from "@/features/drops/_action/QuickSettlement.action";
import DropSheet from "@/features/drops/_action/DropSheet.action";
export default function BossesAction() {
  const q = useBook();
  const { cycle, setCycle } = useAppState();
  const cmd = useCommand();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("전체");
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const { book, report } = q.data;
  const plans = report.plans.filter((p) => {
    const boss = book.bosses.find((b) => b.id === p.bossId)!;
    const char = book.characters.find((c) => c.id === p.characterId)!;
    if (
      !`${boss.name} ${boss.difficulty} ${char.name}`
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase())
    )
      return false;
    const c = report.selected.find(
      (c) =>
        c.characterId === p.characterId &&
        c.group === book.bosses.find((b) => b.id === p.bossId)?.group,
    );
    return (
      filter === "전체" ||
      (filter === "남음" && !c) ||
      (filter === "완료" && c) ||
      (filter === "확인 필요" &&
        c &&
        (!c.difficulty || c.review === "pending" || c.status === "conflict"))
    );
  });
  return (
    <>
      <ReportHeader
        title="내 보스 현황"
        subtitle="완료를 확인하고, 획득한 드랍만 기록하세요."
      />
      <div className="tabs">
        {(["weekly", "daily", "monthly"] as const).map((v, i) => (
          <button
            className={cycle === v ? "active" : ""}
            key={v}
            onClick={() => setCycle(v)}
          >
            {["주간", "일간", "월간"][i]}
          </button>
        ))}
      </div>
      <label className="search-input boss-search">
        <Search size={18} />
        <input
          aria-label="보스 또는 캐릭터 검색"
          placeholder="보스 또는 캐릭터 이름 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <div className="filter-row">
        {["전체", "남음", "완료", "확인 필요"].map((x) => (
          <button
            className={`chip ${filter === x ? "active" : ""}`}
            key={x}
            onClick={() => setFilter(x)}
          >
            {x}
          </button>
        ))}
      </div>
      <section className="panel boss-list">
        {plans.map((p) => {
          const b = book.bosses.find((b) => b.id === p.bossId)!;
          const char = book.characters.find((c) => c.id === p.characterId)!;
          const c = report.selected.find(
            (c) =>
              c.characterId === p.characterId &&
              c.group === book.bosses.find((b) => b.id === p.bossId)?.group,
          );
          return (
            <article className="boss-record" key={p.id}>
              <div className="boss-row">
                <ItemIcon image={b.image} kind={b.icon} />
                <div className="row-body">
                  <strong>
                    {b.name}
                    <span className="difficulty">
                      {c?.difficulty || p.difficulty || "난이도 확인 필요"}
                    </span>
                  </strong>
                  <p>
                    {char.name} ·{" "}
                    {c?.provenance === "manual" ? "수동 기록" : "설정값 기준"}·
                    1인 정산
                  </p>
                </div>
                <div className="boss-status">
                  <span className={c ? "status-done" : "status-muted"}>
                    {c?.excluded ? (
                      "제외"
                    ) : c?.status === "conflict" ? (
                      "정보 확인 필요"
                    ) : c ? (
                      <>
                        <Check size={13} />
                        완료
                      </>
                    ) : (
                      "미완료"
                    )}
                  </span>
                  <small>
                    {c
                      ? c.review === "pending"
                        ? "드랍 미입력"
                        : c.review === "none"
                          ? "없음으로 확인"
                          : "드랍 기록함"
                      : "완료 후 기록"}
                  </small>
                </div>
                <div className="boss-amount">
                  {formatMeso(
                    c
                      ? c.crystal
                      : p.party && p.difficulty && b.crystal
                        ? (BigInt(b.crystal) / BigInt(p.party)).toString()
                        : null,
                  )}
                  {(c ? c.crystal : b.crystal) && <small> 메소</small>}
                </div>
                {!c && <span className="waiting-label">완료 대기</span>}
                <details className="row-menu">
                  <summary aria-label={`${b.name} 상세 메뉴`}>
                    <MoreHorizontal size={20} />
                  </summary>
                  <div>
                    {c ? (
                      <button
                        disabled={cmd.isPending}
                        onClick={() =>
                          cmd.mutate({
                            type: "exclude",
                            id: c.id,
                            value: !c.excluded,
                          })
                        }
                      >
                        {c.excluded ? "제외 복원" : "수동 제외"}
                      </button>
                    ) : (
                      <button
                        disabled={cmd.isPending}
                        onClick={() =>
                          cmd.mutate({ type: "complete", planId: p.id })
                        }
                      >
                        수동 완료 기록
                      </button>
                    )}
                  </div>
                </details>
              </div>
              {c && <QuickSettlement book={book} completion={c} />}
            </article>
          );
        })}
        {!plans.length && (
          <Empty
            title="이 조건에 맞는 보스가 없어요"
            detail="새로고침으로 스케줄러를 조회하거나 설정에서 관리할 보스를 선택해 주세요."
          />
        )}
      </section>
      <DropSheet />
    </>
  );
}
