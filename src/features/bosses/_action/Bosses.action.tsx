"use client";
import { useState } from "react";
import { Check, Search } from "lucide-react";
import { useBook } from "@/shared/_state/useBook";
import { useAppState } from "@/shared/_state/useAppState";
import { useCommand } from "@/shared/_action/useCommand";
import { Avatar, ItemIcon } from "@/shared/_component/Visual";
import { Loading, ErrorState, Empty } from "@/shared/_component/Status";
import { formatMeso } from "@/domain/money";
import type { Character } from "@/domain/model";
import { api } from "@/shared/_lib/api";
import { strongestCharacter } from "../_lib/strongestCharacter";
import { useCharacterStrength } from "../_state/useCharacterStrength";
import { completedBossKeys } from "../_lib/completedBossKeys";
import { BossCutPanel } from "../_component/BossCutPanel";
export default function BossesAction() {
  const q = useBook(true, true);
  const strength = useCharacterStrength(q.data?.book.characters, q.data?.asOf);
  const { notify } = useAppState();
  const cmd = useCommand(true, true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("전체");
  const [searchingId, setSearchingId] = useState<string | null>(null);
  // undefined selects the strongest automatically; null opens the search view.
  const [selectedId, setSelectedId] = useState<string | null | undefined>(
    undefined,
  );
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const { book, report } = q.data;
  const selected =
    selectedId === undefined
      ? strongestCharacter(book.characters)
      : book.characters.find((c) => c.id === selectedId);
  const term = search.trim().toLocaleLowerCase();
  const characters =
    !selected && term
      ? book.characters.filter((c) => c.name.toLocaleLowerCase().includes(term))
      : [];
  const lookupCharacter = async (character: Character) => {
    if (
      book.sync.characters?.some(
        (state) =>
          state.characterId === character.id && state.status !== "error",
      )
    ) {
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
  const plans = report.plans.filter((p) => {
    if (p.characterId !== selected?.id) return false;
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
      {strength.isFetching && (
        <p role="status" className="muted-note">
          캐릭터 전투력을 비교하고 있어요…
        </p>
      )}
      {(strength.isError || !!strength.data?.failed) && (
        <p role="status" className="muted-note">
          일부 전투력을 조회하지 못했어요. 확인된 전투력 기준으로 표시해요.
        </p>
      )}
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
              size={76}
            />
            <div>
              <h2>{selected.name}</h2>
              <p>
                {selected.world} · {selected.job} · Lv. {selected.level}
              </p>
              <p className="boss-character-power">
                {selected.combatPower == null
                  ? selectedId === undefined
                    ? "전투력 미확인 · 레벨 기준 임시 선택"
                    : "전투력 미확인"
                  : `전투력 ${formatMeso(selected.combatPower)}`}
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
          {!(selectedId === undefined && strength.isFetching) && (
            <BossCutPanel
              key={selected.id}
              character={selected}
              completed={completedBossKeys(book, selected.id, q.data.asOf)}
            />
          )}
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
          <section
            className="boss-completion-grid"
            aria-label="이번 주 보스 기록"
          >
            {plans.map((p) => {
              const b = book.bosses.find((b) => b.id === p.bossId)!;
              const c = report.selected.find(
                (c) =>
                  c.characterId === p.characterId &&
                  c.group === book.bosses.find((b) => b.id === p.bossId)?.group,
              );
              return (
                <article
                  className="boss-record boss-completion-card"
                  key={p.id}
                >
                  <div className="boss-completion-title">
                    <ItemIcon image={b.image} kind={b.icon} />
                    <div>
                      <strong>{b.name}</strong>
                      <small>
                        {c?.difficulty || p.difficulty || "난이도 확인 필요"}
                      </small>
                    </div>
                    <span
                      className={
                        c && !c.excluded ? "status-done" : "status-muted"
                      }
                    >
                      {c?.excluded ? (
                        "제외"
                      ) : c?.status === "conflict" ? (
                        "확인 필요"
                      ) : c ? (
                        <>
                          <Check size={13} />
                          완료
                        </>
                      ) : (
                        "미완료"
                      )}
                    </span>
                  </div>
                  <div className="boss-completion-bottom">
                    <div>
                      <small>결정석 · 1인</small>
                      <strong>
                        {formatMeso(c ? c.crystal : b.crystal)}
                        <small> 메소</small>
                      </strong>
                    </div>
                    {!c && (
                      <button
                        className="button soft"
                        disabled={cmd.isPending}
                        onClick={() =>
                          cmd.mutate({ type: "complete", planId: p.id })
                        }
                      >
                        완료 표시
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
            {!plans.length && (
              <Empty
                title="이 조건에 맞는 보스가 없어요"
                detail="이 주기의 보스 기록이 없어요. 보스 조회 후 다시 확인해 주세요."
              />
            )}
          </section>
        </>
      )}
    </>
  );
}
