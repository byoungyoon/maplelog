"use client";
import { useState } from "react";
import { Download, ReceiptText, ChevronRight } from "lucide-react";
import { useBook } from "@/shared/_state/useBook";
import { useAppState } from "@/shared/_state/useAppState";
import { useCommand } from "@/shared/_action/useCommand";
import { ReportHeader } from "@/shared/_area/ReportHeader.area";
import { Loading, ErrorState, Empty } from "@/shared/_component/Status";
import { Sheet } from "@/shared/_component/Sheet";
import { formatMeso, estimate } from "@/domain/money";
import type { Entry } from "@/domain/revenue";
export default function LedgerAction() {
  const q = useBook();
  const cmd = useCommand();
  const { mode, notify } = useAppState();
  const [filter, setFilter] = useState("전체");
  const [basis, setBasis] = useState("record");
  const [target, setTarget] = useState<Entry | null>(null);
  const [qty, setQty] = useState(1);
  const [net, setNet] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [gross, setGross] = useState(false);
  const [fee, setFee] = useState(0);
  const [cost, setCost] = useState("0");
  const [editingId, setEditingId] = useState<string | undefined>();
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const { book, report } = q.data;
  const all = basis === "record" ? report.rows : report.cash;
  const rows = all.filter(
    (x) =>
      filter === "전체" ||
      (filter === "정산 대기" && x.remaining > 0) ||
      (filter === "정산 완료" && x.settledIds.length) ||
      (filter === "확인 필요" && x.unknown),
  );
  const summary = basis === "record" ? report.summary : report.cashSummary;
  const open = (x: Entry) => {
    setTarget(x);
    setNet("");
    setQty(1);
    setEditingId(undefined);
    setGross(false);
  };
  const close = () => {
    if (net && !window.confirm("저장하지 않은 정산 입력을 닫을까요?")) return;
    setTarget(null);
  };
  const parsed =
    /^(0|[1-9]\d{0,39})$/.test(net) && /^(0|[1-9]\d{0,39})$/.test(cost)
      ? gross
        ? estimate(net, 1, fee, cost, 1)?.toString()
        : net
      : null;
  return (
    <>
      <ReportHeader
        title="수익 기록"
        subtitle="전체 캐릭터의 예상 수익과 실제 정산을 한곳에 모았어요."
      />
      <div className="ledger-summary">
        <ReceiptText size={24} />
        <div>
          <span>
            {basis === "record" ? "전체 캐릭터 수익 합계 · 예상 포함" : "정산일 기준 순수령"}
          </span>
          <strong>
            {formatMeso(basis === "record" ? report.projectedTotal : summary.total)}
            <small> 메소</small>
          </strong>
          {basis === "record" && (
            <span>
              실제 정산 {formatMeso(report.summary.actual)} · 완료 보스 미정산 예상 {formatMeso(report.summary.expected)} · 남은 보스 예상 {formatMeso(report.remainingKnownAmount)}
            </span>
          )}
        </div>
        <a href={`/api/export?mode=${mode}&format=csv`} className="button">
          <Download size={16} />
          CSV 내보내기
        </a>
      </div>
      <div className="ledger-controls">
        <div className="filter-row">
          {["전체", "정산 대기", "정산 완료", "확인 필요"].map((x) => (
            <button
              className={`chip ${filter === x ? "active" : ""}`}
              key={x}
              onClick={() => setFilter(x)}
            >
              {x}
            </button>
          ))}
        </div>
        <label>
          <span className="sr-only">보고서 기준</span>
          <select value={basis} onChange={(e) => setBasis(e.target.value)}>
            <option value="record">보스 기록 주기 기준</option>
            <option value="cash">실제 정산일 기준</option>
          </select>
        </label>
      </div>
      <section className="panel ledger-list">
        {rows.length ? (
          rows.map((r, index) => {
            const c = book.characters.find((c) => c.id === r.characterId)!;
            const b = book.bosses.find((b) => b.id === r.bossId)!;
            return (
              <button
                className="ledger-row"
                key={`${r.id}-${index}`}
                onClick={() => open(r)}
              >
                <span
                  className={`activity-icon ${r.remaining === 0 ? "green" : ""}`}
                >
                  <ReceiptText size={18} />
                </span>
                <div className="row-body">
                  <strong>
                    {r.name}
                    {r.quantity > 1 && (
                      <span className="quantity-label">{r.quantity}개</span>
                    )}
                  </strong>
                  <p>
                    {c.name} · {b.name} ·{" "}
                    {r.source === "manual"
                      ? "수동 기록"
                      : r.source === "initial"
                        ? "기존 완료 불러옴"
                        : "API 기록"}
                  </p>
                </div>
                <div className="ledger-amount">
                  <strong>
                    {r.unknown
                      ? "가격 확인 필요"
                      : formatMeso(r.total) +
                        (r.excluded ? " (예상 제외)" : "")}
                  </strong>
                  <span>
                    {r.remaining === 0
                      ? "정산 완료"
                      : r.settledIds.length
                        ? `일부 정산 · ${r.remaining}개 대기`
                        : "미정산 예상"}
                  </span>
                </div>
                <ChevronRight size={17} />
              </button>
            );
          })
        ) : (
          <Empty
            title="아직 이 기간의 기록이 없어요"
            detail="보스 완료와 드랍을 기록하면 여기에 정리돼요."
          />
        )}
      </section>
      {target && (
        <Sheet title="정산하기" onClose={close} busy={cmd.isPending}>
          <div className="sheet-content">
            <h2>{target.name}</h2>
            <p className="sheet-description">
              내가 실제로 받은 메소를 기록해 주세요.
            </p>
            <form
              className="detail-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!parsed) return;
                cmd.mutate(
                  {
                    type: "settle",
                    targetId: target.id,
                    kind: target.kind,
                    quantity: qty,
                    net: parsed,
                    settledAt: new Date(`${date}T12:00:00+09:00`).toISOString(),
                    settlementId: editingId,
                  },
                  {
                    onSuccess: () => {
                      setTarget(null);
                      setNet("");
                      notify(
                        "정산을 저장했어요. 해당 수량의 예상액을 실제액으로 바꿨어요.",
                      );
                    },
                  },
                );
              }}
            >
              <div className="notice">
                미정산 {target.remaining}개 · 예상 {formatMeso(target.expected)}{" "}
                메소
              </div>
              <label>
                정산 수량
                <input
                  type="number"
                  min="1"
                  max={target.quantity}
                  value={qty}
                  required
                  onChange={(e) => setQty(Number(e.target.value))}
                />
              </label>
              <label>
                {gross ? "총판매가" : "실제 순수령액"} (메소)
                <input
                  autoFocus
                  inputMode="numeric"
                  pattern="[0-9]+"
                  placeholder="예: 90000000"
                  value={net}
                  required
                  onChange={(e) => setNet(e.target.value)}
                />
              </label>
              <label>
                실제 받은 날짜
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={gross}
                  onChange={(e) => setGross(e.target.checked)}
                />
                총판매가로 계산하기
              </label>
              {gross && (
                <>
                  <label>
                    수수료 (basis points)
                    <input
                      type="number"
                      min="0"
                      max="10000"
                      value={fee}
                      onChange={(e) => setFee(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    비용 (메소)
                    <input
                      inputMode="numeric"
                      pattern="[0-9]+"
                      value={cost}
                      onChange={(e) => setCost(e.target.value)}
                    />
                  </label>
                  <div className="notice">
                    1인 기준 차감 후 순수령 {formatMeso(parsed ?? null)} 메소
                    <br />
                    총판매가 − 수수료(내림) − 비용 → 인원으로 나눔(내림)
                  </div>
                </>
              )}
              <p className="muted-note">
                순수령액에는 수수료와 분배를 다시 적용하지 않아요.
              </p>
              {cmd.isError && (
                <p role="alert" className="field-error">
                  {cmd.error.message}
                </p>
              )}
              <button
                className="button primary full"
                disabled={cmd.isPending || !parsed}
              >
                {cmd.isPending
                  ? "저장 중…"
                  : editingId
                    ? "정산 수정"
                    : "정산하기"}
              </button>
            </form>
            <h3 className="detail-heading">정산 이력</h3>
            {book.settlements
              .filter(
                (x) =>
                  !x.deleted &&
                  x.targetId === target.id &&
                  x.kind === target.kind,
              )
              .map((x) => (
                <div className="settlement-history" key={x.id}>
                  <p>
                    {x.settledAt.slice(0, 10)} · {x.quantity}개<br />
                    <b>{formatMeso(x.net)} 메소</b>
                  </p>
                  <button
                    className="text-button"
                    onClick={() => {
                      setEditingId(x.id);
                      setQty(x.quantity);
                      setNet(x.net);
                      setDate(x.settledAt.slice(0, 10));
                    }}
                  >
                    수정
                  </button>
                  <button
                    className="text-button danger-text"
                    disabled={cmd.isPending}
                    onClick={() =>
                      cmd.mutate(
                        { type: "cancel-settlement", id: x.id },
                        {
                          onSuccess: () => {
                            setTarget(null);
                            notify("정산을 취소하고 예상액을 복원했어요.");
                          },
                        },
                      )
                    }
                  >
                    취소
                  </button>
                </div>
              ))}
            {target.kind === "drop" && target.remaining > 0 && (
              <button
                className="button full"
                disabled={cmd.isPending}
                onClick={() =>
                  cmd.mutate(
                    { type: "revalue", id: target.id },
                    {
                      onSuccess: () => {
                        setTarget(null);
                        notify("현재 기준가로 명시적 재평가를 기록했어요.");
                      },
                    },
                  )
                }
              >
                현재 기준가로 재평가
              </button>
            )}
            <details className="audit-details">
              <summary>변경 이력 보기</summary>
              {book.audit
                .filter(
                  (a) =>
                    a.targetId === target.id ||
                    a.targetId === target.completionId,
                )
                .map((a) => (
                  <p key={a.id}>
                    {a.title} · {a.detail}
                  </p>
                ))}
            </details>
          </div>
        </Sheet>
      )}
    </>
  );
}
