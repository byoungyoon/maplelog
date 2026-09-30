"use client";
import { CircleCheck } from "lucide-react";
import { useState } from "react";
import type { Character } from "@/domain/model";
import catalogue from "@/data/scouter-catalog.json";
import { ItemIcon } from "@/shared/_component/Visual";
import { useBossAnalysis } from "../_state/useBossAnalysis";

const filters = ["전체", "솔플 가능", "파티 가능"] as const;
export function BossCutPanel({
  character,
  completed,
}: {
  character: Character;
  completed: Set<string>;
}) {
  const analysis = useBossAnalysis(character.id);
  const [filter, setFilter] = useState<(typeof filters)[number]>("전체");
  const data = analysis.data;
  const solo =
    data?.cuts.filter((c) => c.entryAllowed && c.status.startsWith("솔플")) ??
    [];
  const party =
    data?.cuts.filter(
      (c) =>
        c.entryAllowed && !c.status.startsWith("솔플") && c.status !== "불가능",
    ) ?? [];
  const cuts =
    filter === "솔플 가능"
      ? solo
      : filter === "파티 가능"
        ? party
        : (data?.cuts ?? []);
  return (
    <section className="panel boss-cut-panel" aria-label="보스 최소컷 분석">
      <div className="boss-cut-heading">
        <div>
          <h2>보스 최소컷</h2>
          <p>내 스펙으로 어디까지 도전할 수 있을까?</p>
        </div>
        <button
          className="button"
          disabled={analysis.isFetching}
          onClick={() => void analysis.refetch()}
        >
          {analysis.isFetching ? "분석 중…" : "다시 조회"}
        </button>
      </div>
      {analysis.isPending && (
        <p role="status">{character.name}의 스펙을 분석하고 있어요…</p>
      )}
      {analysis.error && (
        <p role="alert" className="notice warning">
          {analysis.error.message}
          {data && " 이전 조회 결과를 표시하고 있어요."}
        </p>
      )}
      {data && (
        <>
          <div className="boss-cut-summary">
            <div>
              <span>내 헥사 환산</span>
              <strong>{data.hexa380.toLocaleString("ko-KR")}</strong>
            </div>
            <div>
              <span>솔플 도전 가능</span>
              <strong>
                {solo.length}
                <small>개</small>
              </strong>
            </div>
            <div>
              <span>파티 도전 가능</span>
              <strong>
                {party.length}
                <small>개</small>
              </strong>
            </div>
          </div>
          <div className="boss-cut-filters" aria-label="최소컷 필터">
            {filters.map((value) => (
              <button
                key={value}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {value}
              </button>
            ))}
          </div>
          <div className="boss-cut-grid">
            {cuts.map((cut) => {
              const tone = cut.status.startsWith("솔플")
                ? "solo"
                : cut.status === "불가능" || !cut.entryAllowed
                  ? "short"
                  : "party";
              const image = catalogue.bosses.find(
                (b) => b.key === cut.key,
              )?.image;
              const ratio =
                cut.rate /
                (cut.partyReference ? (cut.partyLimit === 3 ? 2.7 : 5.1) : 0.9);
              const percent = Math.round(ratio * 100);
              const margin =
                ratio >= 1
                  ? `최소컷의 ${ratio.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}배`
                  : `최소컷까지 ${Math.ceil((1 - ratio) * 100)}% 부족`;
              return (
                <article
                  className="boss-cut-card"
                  data-tone={tone}
                  key={cut.key}
                  aria-label={`${cut.name} ${cut.difficulty} 최소컷`}
                >
                  <div className="boss-cut-card-title">
                    <ItemIcon image={image} kind="crown" />
                    <div>
                      <strong>{cut.name}</strong>
                      <small>
                        {cut.difficulty}
                        {completed.has(cut.key) && (
                          <span className="boss-cut-cleared">
                            <CircleCheck size={13} aria-hidden />
                            처치 완료
                          </span>
                        )}
                      </small>
                    </div>
                    <span className="boss-cut-verdict">
                      {cut.status === "불가능" ? "스펙 부족" : cut.status}
                    </span>
                  </div>
                  <div className="boss-cut-gauge-heading">
                    <strong>
                      {cut.entryAllowed ? margin : "입장 레벨 미달"}
                    </strong>
                    <span>솔플 기준</span>
                  </div>
                  <div
                    className="boss-cut-gauge"
                    role="meter"
                    aria-label={`${cut.name} ${cut.difficulty} 솔플 최소컷 대비`}
                    aria-valuemin={0}
                    aria-valuemax={200}
                    aria-valuenow={Math.min(200, percent)}
                    aria-valuetext={`솔플 최소컷 대비 ${percent}퍼센트${!cut.entryAllowed ? ", 입장 레벨 미달" : ""}`}
                  >
                    <span
                      className="boss-cut-gauge-fill"
                      style={{ width: `${Math.min(100, ratio * 50)}%` }}
                    />
                    <span className="boss-cut-gauge-target" />
                  </div>
                  <div className="boss-cut-gauge-scale">
                    <span>0</span>
                    <span>최소컷</span>
                    <span>2배 이상</span>
                  </div>
                  <details className="boss-cut-values">
                    <summary>환산 수치</summary>
                    <span>
                      내 적용 {cut.effectiveStat.toLocaleString("ko-KR")} · 솔플
                      최소 {cut.minimumStat.toLocaleString("ko-KR")}
                    </span>
                  </details>
                  <div className="boss-cut-notes">
                    {!cut.entryAllowed && (
                      <span>Lv. {cut.entryLevel}부터 입장</span>
                    )}
                    {(cut.levelPenalty || cut.forcePenalty) && (
                      <span>
                        {[
                          cut.levelPenalty && "레벨",
                          cut.forcePenalty && "포스",
                        ]
                          .filter(Boolean)
                          .join("·")}{" "}
                        보정 적용
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          {!cuts.length && (
            <p className="muted-note">현재 조건에 맞는 보스가 없어요.</p>
          )}
          <details className="boss-cut-explanation">
            <summary>계산 기준 보기</summary>
            <p>
              20분 숙련자·기본 프리셋 기준이며 하드 루시드는 3페이즈 기준이에요.
              게이지는 레벨·포스 보정 후 딜 배율을 솔플 최소컷과 비교한 값이며,
              클리어 확률이 아니에요. 게이지는 2배에서 가득 차며 실제 배율은
              위에 표시해요. 실제 클리어는 숙련도와 패턴에 따라 달라질 수
              있어요.
            </p>
            <p>
              기준표 {data.version} ·{" "}
              {new Date(data.checkedAt).toLocaleString("ko-KR", {
                timeZone: "Asia/Seoul",
              })}{" "}
              조회
            </p>
          </details>
        </>
      )}
    </section>
  );
}
