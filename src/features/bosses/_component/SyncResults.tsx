import type { Ledger } from "@/domain/model";
import { Avatar } from "@/shared/_component/Visual";
import { timeLabel } from "@/domain/period";
export function SyncResults({ book }: { book: Ledger }) {
  const states = book.sync.characters ?? [];
  return (
    <details className="audit-details sync-results">
      <summary>
        캐릭터별 조회 상태 · {states.filter((s) => s.status === "ok").length}개
        정상 / {states.filter((s) => s.status === "empty").length}개 빈 목록
      </summary>
      {book.characters
        .filter((c) => c.managed)
        .map((c) => {
          const state = states.find((s) => s.characterId === c.id);
          return (
            <div className="sync-result-row" key={c.id}>
              <Avatar image={c.image} variant={c.avatar} size={44} />
              <div>
                <strong>{c.name}</strong>
                <p>
                  {state?.message ??
                    (state?.status === "ok"
                      ? `스케줄러 ${state.bossCount}개 항목 · 이번 주 완료 ${state.weeklyClearCount} / ${state.weeklyClearLimit}`
                      : "아직 조회하지 않았어요.")}
                </p>
              </div>
              <small>{state ? timeLabel(state.checkedAt) : "조회 대기"}</small>
            </div>
          );
        })}
    </details>
  );
}
