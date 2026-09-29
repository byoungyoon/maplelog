"use client";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useBook } from "../_state/useBook";
import { useAppState } from "../_state/useAppState";
import { useCommand } from "../_action/useCommand";
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
  const { offset, setOffset, notify, cycle, setCycle } = useAppState();
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
            disabled={
              cmd.isPending || !data?.book.characters.length
            }
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
        </div>
      </div>
      {data?.book.sync.error && (
        <div className="notice warning" role="alert">
          {data.book.sync.error}
        </div>
      )}
    </>
  );
}
