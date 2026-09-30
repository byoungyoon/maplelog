"use client";
import { ManualItem } from "./ManualItem.action";
import { useState } from "react";
import { Check, Minus, Plus, Undo2 } from "lucide-react";
import { useAppState } from "@/shared/_state/useAppState";
import { useBook } from "@/shared/_state/useBook";
import { useCommand } from "@/shared/_action/useCommand";
import { Sheet } from "@/shared/_component/Sheet";
import { ItemIcon } from "@/shared/_component/Visual";
import { formatMeso } from "@/domain/money";
import { timeLabel } from "@/domain/period";
import type { Drop } from "@/domain/model";
export default function DropSheet() {
  const { sheet, openSheet, notify } = useAppState();
  const { data } = useBook();
  const cmd = useCommand();
  const [undo, setUndo] = useState<{ itemId: string; quantity: number } | null>(
    null,
  );
  const [confirmNone, setConfirmNone] = useState(false);
  const [editing, setEditing] = useState<Drop | null>(null);
  if (!sheet || !data) return null;
  const c = data.book.completions.find((c) => c.id === sheet);
  if (!c) return null;
  const b = data.book.bosses.find((b) => b.id === c.bossId)!;
  const character = data.book.characters.find((x) => x.id === c.characterId)!;
  const drops = data.book.drops.filter(
    (d) => d.completionId === c.id && d.quantity > 0,
  );
  const change = (itemId: string, quantity: number) => {
    const previous = drops.find((d) => d.itemId === itemId)?.quantity ?? 0;
    cmd.mutate(
      { type: "drop", completionId: c.id, itemId, quantity },
      {
        onSuccess: () => {
          setUndo({ itemId, quantity: previous });
          notify("드랍을 저장했어요. 시트에서 되돌릴 수 있어요.");
        },
      },
    );
  };
  const close = () => {
    if (editing && !window.confirm("저장하지 않은 상세 변경을 닫을까요?"))
      return;
    setEditing(null);
    setUndo(null);
    setConfirmNone(false);
    openSheet(null);
  };
  return (
    <Sheet title="어떤 아이템을 얻었나요?" onClose={close} busy={cmd.isPending}>
      <div className="sheet-content">
        <div className="sheet-context">
          <ItemIcon image={b.image} kind={b.icon} small />
          <span>
            {character.name} · {b.name}
            <small>
              {c.difficulty || "난이도 확인 필요"} · 완료 감지{" "}
              {timeLabel(c.detectedAt)}
            </small>
          </span>
        </div>
        <p className="solo-caption">결정석 · 드랍 모두 1인 기준</p>
        <h2>어떤 아이템을 얻었나요?</h2>
        <ManualItem bossId={b.id} />
        <p className="sheet-description">
          획득한 아이템만 누르면 예상 수익에 반영돼요.
        </p>
        <div className="notice compact">
          보스별 드랍 후보예요. 실제 획득한 아이템만 선택해 주세요.
        </div>
        <div className="drop-options">
          {b.items.map((id) => {
            const i = data.book.items.find((i) => i.id === id)!;
            const d = drops.find((d) => d.itemId === id);
            return (
              <div className={`drop-option ${d ? "selected" : ""}`} key={id}>
                <button
                  className="drop-select"
                  disabled={cmd.isPending || c.excluded}
                  aria-pressed={!!d}
                  onClick={() => change(id, d ? 0 : 1)}
                >
                  <ItemIcon image={i.image} kind={i.icon} />
                  <span>
                    <strong>{i.name}</strong>
                    <small>
                      {i.tradeConfirmed === false
                        ? "거래 조건 확인 필요"
                        : !i.tradable
                          ? "거래 불가 · 보유 기록"
                          : formatMeso(i.price) + (i.price ? " 메소" : "")}
                    </small>
                  </span>
                  <span className="selection-check">
                    {d && <Check size={15} />}
                  </span>
                </button>
                {d && (
                  <div className="drop-quantity">
                    <button
                      className="text-button"
                      onClick={() => setEditing({ ...d })}
                    >
                      상세 설정
                    </button>
                    <div>
                      <button
                        aria-label={`${i.name} 수량 감소`}
                        disabled={cmd.isPending}
                        onClick={() => change(id, d.quantity - 1)}
                      >
                        <Minus size={14} />
                      </button>
                      <span>{d.quantity}</span>
                      <button
                        aria-label={`${i.name} 수량 증가`}
                        disabled={cmd.isPending}
                        onClick={() => change(id, d.quantity + 1)}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {editing && (
          <form
            className="detail-form"
            onSubmit={(e) => {
              e.preventDefault();
              cmd.mutate(
                {
                  type: "drop-edit",
                  id: editing.id,
                  tradable: editing.tradable,
                  shared: false,
                  share: 1,
                  feeBps: editing.feeBps,
                  cost: editing.cost,
                  used: editing.used,
                  note: editing.note,
                },
                { onSuccess: () => setEditing(null) },
              );
            }}
          >
            <h3>아이템 상세</h3>
            <p>
              기록 당시 기준가 {formatMeso(editing.unitPrice)} ·{" "}
              {editing.priceSource}
              <br />
              {editing.market.replaceAll("메이플스카우터 ", "")} /{" "}
              {editing.variant}
            </p>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={editing.tradable}
                onChange={(e) =>
                  setEditing({ ...editing, tradable: e.target.checked })
                }
              />
              거래 가능
            </label>
            <label>
              수수료 (basis points, 100 = 1%)
              <input
                type="number"
                min="0"
                max="10000"
                required
                value={editing.feeBps}
                onChange={(e) =>
                  setEditing({ ...editing, feeBps: Number(e.target.value) })
                }
              />
            </label>
            <label>
              드랍 전체에 적용할 비용 (메소)
              <input
                inputMode="numeric"
                pattern="[0-9]+"
                required
                value={editing.cost}
                onChange={(e) =>
                  setEditing({ ...editing, cost: e.target.value })
                }
              />
            </label>
            <label>
              사용·제외 수량
              <input
                type="number"
                min="0"
                max={editing.quantity}
                required
                value={editing.used}
                onChange={(e) =>
                  setEditing({ ...editing, used: Number(e.target.value) })
                }
              />
            </label>
            <label>
              메모
              <textarea
                value={editing.note}
                onChange={(e) =>
                  setEditing({ ...editing, note: e.target.value })
                }
              />
            </label>
            <button
              type="button"
              className="button"
              disabled={cmd.isPending}
              onClick={() =>
                cmd.mutate(
                  { type: "revalue", id: editing.id },
                  {
                    onSuccess: () => {
                      setEditing(null);
                      notify("현재 기준가를 적용했어요.");
                    },
                  },
                )
              }
            >
              현재 기준가 적용
            </button>
            <button className="button primary" disabled={cmd.isPending}>
              상세 저장
            </button>
          </form>
        )}
        {undo && (
          <button
            className="undo-button"
            disabled={cmd.isPending}
            onClick={() =>
              cmd.mutate(
                {
                  type: "drop",
                  completionId: c.id,
                  itemId: undo.itemId,
                  quantity: undo.quantity,
                },
                { onSuccess: () => setUndo(null) },
              )
            }
          >
            <Undo2 size={15} />
            마지막 선택 되돌리기
          </button>
        )}
        {cmd.isError && (
          <p className="field-error" role="alert">
            {cmd.error.message} 값을 확인하고 다시 눌러 주세요.
          </p>
        )}
        <div className="autosave-state" role="status">
          {cmd.isPending ? (
            "저장 중…"
          ) : (
            <>
              <Check size={14} />
              변경할 때마다 자동 저장돼요
            </>
          )}
        </div>
        {confirmNone && (
          <div className="notice warning">
            <p>
              선택한 {drops.length}종의 획득 기록을 삭제하고 ‘없음’으로
              바꿀까요?
            </p>
            <button
              className="button danger"
              disabled={cmd.isPending}
              onClick={() =>
                cmd.mutate(
                  { type: "review", id: c.id, value: "none", confirm: true },
                  { onSuccess: close },
                )
              }
            >
              선택 삭제 후 없음으로 확인
            </button>
            <button
              className="text-button"
              onClick={() => setConfirmNone(false)}
            >
              취소
            </button>
          </div>
        )}
        <div className="sheet-footer">
          <button
            className="button"
            disabled={cmd.isPending}
            onClick={() =>
              drops.length
                ? setConfirmNone(true)
                : cmd.mutate(
                    { type: "review", id: c.id, value: "none" },
                    { onSuccess: close },
                  )
            }
          >
            없었어요
          </button>
          <button
            className="button primary"
            disabled={cmd.isPending}
            onClick={close}
          >
            기록 마치기
          </button>
        </div>
        <p className="muted-note text-center">
          기록 마치기는 시트를 닫아요. 닫기만 하면 ‘없음’으로 바뀌지 않아요.
        </p>
      </div>
    </Sheet>
  );
}
