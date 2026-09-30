"use client";
import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { useBook } from "@/shared/_state/useBook";
import { useCommand } from "@/shared/_action/useCommand";
import { Avatar, ItemIcon } from "@/shared/_component/Visual";
import { Loading, ErrorState, Empty } from "@/shared/_component/Status";
import { formatMeso } from "@/domain/money";
import { strongestCharacter } from "../_lib/strongestCharacter";
import { useCharacterStrength } from "../_state/useCharacterStrength";
import { completedBossKeys } from "../_lib/completedBossKeys";
import { BossCutPanel } from "../_component/BossCutPanel";
export default function BossesAction() {
  const q = useBook(true, true);
  const strength = useCharacterStrength(q.data?.book.characters, q.data?.asOf);
  const cmd = useCommand(true, true);
  const [filter, setFilter] = useState("전체");
  const selectedId = useSearchParams().get("character");
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const { book, report } = q.data;
  const explicitSelection = book.characters.find((c) => c.id === selectedId);
  const selected = explicitSelection ?? strongestCharacter(book.characters);
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
        <Empty
          title="연결된 캐릭터가 없어요"
          detail="키 연결을 확인해 주세요."
        />
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
                  ? !explicitSelection
                    ? "전투력 미확인 · 레벨 기준 임시 선택"
                    : "전투력 미확인"
                  : `전투력 ${formatMeso(selected.combatPower)}`}
              </p>
            </div>
            <Link
              className="button"
              href={`/bosses/characters?${new URLSearchParams({ character: selected.id })}`}
              scroll={false}
            >
              다른 캐릭터 검색
            </Link>
          </div>
          {!(!explicitSelection && strength.isFetching) && (
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
                      className={`boss-completion-status ${c && !c.excluded ? "status-done" : "status-muted"}`}
                    >
                      {c?.excluded ? (
                        "제외"
                      ) : c?.status === "conflict" ? (
                        "확인 필요"
                      ) : c ? (
                        <>
                          <Check size={13} aria-hidden />
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
