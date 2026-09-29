"use client";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useBook } from "../_state/useBook";
import { useAppState } from "../_state/useAppState";
import { useCommand } from "../_action/useCommand";
import { SyncResults } from "@/features/bosses/_component/SyncResults";
import { periodLabel, timeLabel } from "@/domain/period";
export function ReportHeader({
  title,
  subtitle,
  compact = false,
}: {
  title: string;
  subtitle: string;
  compact?: boolean;
}) {
  const { data } = useBook();
  const {
    offset,
    setOffset,
    character,
    setCharacter,
    notify,
    cycle,
    setCycle,
  } = useAppState();
  const cmd = useCommand();
  return (
    <>
      {!compact && (
        <div className="page-heading">
          <div>
            <div className="eyebrow">MY MESOLOG</div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <label className="character-select">
            <span className="sr-only">캐릭터 선택</span>
            <select
              aria-label="캐릭터 선택"
              value={character}
              onChange={(e) => setCharacter(e.target.value)}
            >
              <option value="all">전체 캐릭터</option>
              {data?.book.characters
                .filter((c) => c.managed)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
      )}
      <div className={`report-toolbar ${compact ? "compact-toolbar" : ""}`}>
        <div className="period-control">
          <label>
            <span className="sr-only">조회 주기</span>
            <select
              className="cycle-select"
              value={cycle}
              onChange={(e) =>
                setCycle(e.target.value as "daily" | "weekly" | "monthly")
              }
            >
              <option value="weekly">주간</option>
              <option value="daily">일간</option>
              <option value="monthly">월간</option>
            </select>
          </label>
          <button
            aria-label="이전 기간"
            className="icon-button"
            onClick={() => setOffset(Math.max(-52, offset - 1))}
          >
            <ChevronLeft size={18} />
          </button>
          <span>
            {data
              ? periodLabel(data.report.period.start, data.report.period.end)
              : "기간 확인 중"}
          </span>
          <button
            aria-label="다음 기간"
            className="icon-button"
            disabled={offset === 0}
            onClick={() => setOffset(offset + 1)}
          >
            <ChevronRight size={18} />
          </button>
          {offset === 0 && <span className="subtle-badge">이번 기간</span>}
        </div>
        {compact && (
          <span className="settlement-scope">전체 캐릭터 · 1인 정산</span>
        )}
        <div className="sync-controls">
          {!compact && (
            <span className="last-sync">
              마지막 확인 {timeLabel(data?.book.sync.lastSuccess ?? null)}
            </span>
          )}
          <button
            className="text-button"
            disabled={cmd.isPending}
            onClick={() =>
              cmd.mutate(
                { type: "sync", scenario: "refresh" },
                {
                  onSuccess: () =>
                    notify(
                      "보스 조회가 끝났어요. 캐릭터별 결과를 확인해 주세요.",
                    ),
                },
              )
            }
          >
            <RefreshCw
              size={14}
              className={cmd.isPending ? "animate-spin" : ""}
            />
            {cmd.isPending ? "보스 조회 중…" : "새로고침"}
          </button>
          {!compact && (
            <>
              <span className="toolbar-divider" />
              <label className="focus-control">
                집중 추적
                <input
                  type="checkbox"
                  role="switch"
                  checked={
                    !!data?.book.sync.focusUntil &&
                    new Date(data.book.sync.focusUntil) > new Date()
                  }
                  disabled={cmd.isPending}
                  onChange={(e) => {
                    const c =
                      character === "all"
                        ? data?.book.characters.find((c) => c.managed)?.id
                        : character;
                    if (e.target.checked && c)
                      cmd.mutate({ type: "focus", characterId: c });
                    else cmd.mutate({ type: "focus", characterId: null });
                  }}
                />
              </label>
            </>
          )}
        </div>
      </div>
      {data && !compact && <SyncResults book={data.book} />}
      {data?.book.sync.error && (
        <div className="notice warning" role="alert">
          {data.book.sync.error}
        </div>
      )}
      {!compact &&
        data?.book.sync.focusUntil &&
        new Date(data.book.sync.focusUntil) > new Date() && (
          <div className="notice">
            {
              data.book.characters.find(
                (c) => c.id === data.book.sync.focusCharacter,
              )?.name
            }{" "}
            · {timeLabel(data.book.sync.focusUntil)}까지 집중 추적 설정 · 워커
            실행 중에는 2분마다 이 캐릭터를 조회해요.
          </div>
        )}
    </>
  );
}
