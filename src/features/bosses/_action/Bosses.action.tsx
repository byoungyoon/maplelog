"use client";
import { useState } from "react";
import { Check, MoreHorizontal, Search } from "lucide-react";
import { useBook } from "@/shared/_state/useBook";
import { useAppState } from "@/shared/_state/useAppState";
import { useCommand } from "@/shared/_action/useCommand";
import { ReportHeader } from "@/shared/_area/ReportHeader.area";
import { Avatar, ItemIcon } from "@/shared/_component/Visual";
import { Loading, ErrorState, Empty } from "@/shared/_component/Status";
import { formatMeso } from "@/domain/money";
import type { Character } from "@/domain/model";
import { api } from "@/shared/_lib/api";
export default function BossesAction() {
  const q = useBook();
  const { notify } = useAppState();
  const cmd = useCommand();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("전체");
  const [searchingId, setSearchingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const { book, report } = q.data;
  const selected = book.characters.find((c) => c.id === selectedId);
  const term = search.trim().toLocaleLowerCase();
  const characters =
    !selected && term
      ? book.characters.filter((c) => c.name.toLocaleLowerCase().includes(term))
      : [];
  const lookupCharacter = async (character: Character) => {
    if (book.sync.characters?.some(
      (state) =>
        state.characterId === character.id && state.status !== "error",
    )) {
      setSelectedId(character.id);
      setSearch("");
      return;
    }
    setSearchingId(character.id);
    try {
      const result = await api<{
        coalesced: boolean;
        failed: number;
      }>("sync/request", { characterId: character.id });
      await q.refetch();
      setSelectedId(character.id);
      setSearch("");
      notify(
        result.coalesced
          ? "다른 보스 조회가 진행 중이에요. 잠시 뒤 다시 조회해 주세요."
          : result.failed
            ? "보스 조회에 실패했어요. 조회 상태를 확인해 주세요."
            : `${character.name}의 보스를 불러왔어요.`,
      );
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "보스 조회에 실패했어요.",
      );
    } finally {
      setSearchingId(null);
    }
  };
  const allPlans = report.plans.filter((p) => p.characterId === selectedId);
  const plans = report.plans.filter((p) => {
    if (p.characterId !== selectedId) return false;
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
        title="보스 상세"
        subtitle="캐릭터를 검색해 보스별 상태를 확인하세요."
      />
      {!selected ? (
        <>
          <label className="search-input boss-search">
            <Search size={18} />
            <input
              aria-label="캐릭터 검색"
              placeholder="캐릭터 이름 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          {characters.length > 0 && (
            <div
              className="boss-character-results"
              aria-label="캐릭터 검색 결과"
            >
              {characters.slice(0, 8).map((character) => (
                <div className="boss-character-result" key={character.id}>
                  <Avatar
                    image={character.image}
                    variant={character.avatar}
                    size={42}
                  />
                  <span>
                    <strong>{character.name}</strong>
                    <small>
                      {character.world} · {character.job} · Lv.{" "}
                      {character.level}
                    </small>
                  </span>
                  <button
                    className="button"
                    disabled={searchingId !== null || cmd.isPending}
                    onClick={() => void lookupCharacter(character)}
                  >
                    {searchingId === character.id
                      ? "조회 중…"
                      : book.sync.characters?.some(
                            (state) =>
                              state.characterId === character.id &&
                              state.status !== "error",
                          )
                        ? "상세보기"
                        : "보스 조회"}
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="panel boss-search-empty">
            {book.characters.length
              ? "캐릭터 이름을 검색해 보스 상세를 열어보세요."
              : "연결된 계정에서 캐릭터를 찾지 못했어요. 키 연결을 확인해 주세요."}
          </div>
        </>
      ) : (
        <>
          <div className="boss-detail-hero">
            <Avatar
              image={selected.image}
              variant={selected.avatar}
              size={58}
            />
            <div>
              <span>캐릭터 보스 상세</span>
              <h2>{selected.name}</h2>
              <p>
                {selected.world} · {selected.job} · Lv. {selected.level} · 보스{" "}
                {allPlans.length}개
              </p>
            </div>
            <button
              className="button"
              onClick={() => {
                setSelectedId(null);
                setSearch("");
              }}
            >
              다른 캐릭터 검색
            </button>
          </div>
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
                        {c?.provenance === "manual"
                          ? "수동 기록"
                          : "스케줄러 기준"}
                        · 1인 기준
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
                </article>
              );
            })}
            {!plans.length && (
              <Empty
                title="이 조건에 맞는 보스가 없어요"
                detail="이 주기의 보스 기록이 없어요. 다른 주기를 확인하거나 새로고침해 주세요."
              />
            )}
          </section>
        </>
      )}
    </>
  );
}
