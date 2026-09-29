"use client";
import { Check, MoreHorizontal } from "lucide-react";
import { useIsMutating } from "@tanstack/react-query";
import type { Completion, Ledger } from "@/domain/model";
import { formatMeso } from "@/domain/money";
import { useCommand } from "@/shared/_action/useCommand";
import { useAppState } from "@/shared/_state/useAppState";
import { ItemIcon } from "@/shared/_component/Visual";
import { quickDrops } from "../_lib/quickDrops";

export function QuickSettlement({
  book,
  completion,
}: {
  book: Ledger;
  completion: Completion;
}) {
  const cmd = useCommand();
  const busy = useIsMutating({ mutationKey: ["command"] }) > 0;
  const openSheet = useAppState((s) => s.openSheet);
  const boss = book.bosses.find((b) => b.id === completion.bossId)!;
  const items = quickDrops(book, boss);
  const paid = book.settlements.some(
    (s) => !s.deleted && s.kind === "crystal" && s.targetId === completion.id,
  );
  const selectedCount = book.drops.filter(
    (d) => d.completionId === completion.id && d.quantity > 0,
  ).length;
  return (
    <div className="quick-settlement">
      <div className="quick-crystal">
        <span>
          <small>결정석 · 1인 기준</small>
          <strong>
            {formatMeso(completion.crystal)} <em>메소</em>
          </strong>
        </span>
        <button
          className={`button ${paid ? "soft" : "primary"}`}
          disabled={
            busy ||
            paid ||
            completion.crystal === null ||
            completion.status === "conflict" ||
            completion.excluded
          }
          onClick={() =>
            cmd.mutate({ type: "crystal-settle", id: completion.id })
          }
        >
          {paid ? (
            <>
              <Check size={14} />
              정산 완료
            </>
          ) : (
            "결정석 정산"
          )}
        </button>
      </div>
      <div className="quick-drop-heading">
        <span>
          주요 드랍 <small>가격순 · 최대 5개</small>
        </span>
        <button
          className="text-button"
          onClick={() => openSheet(completion.id)}
          aria-label={`${boss.name} 드랍 상세`}
        >
          <MoreHorizontal size={16} />
          상세{selectedCount > 0 ? ` · ${selectedCount}` : ""}
        </button>
      </div>
      <div
        className="quick-drop-options"
        role="group"
        aria-label={`${boss.name} 주요 드랍`}
      >
        {items.map((item) => {
          const drop = book.drops.find(
            (d) => d.completionId === completion.id && d.itemId === item.id,
          );
          const selected = !!drop?.quantity;
          const locked =
            selected &&
            (!!drop.used ||
              book.settlements.some(
                (s) =>
                  !s.deleted && s.kind === "drop" && s.targetId === drop.id,
              ));
          return (
            <button
              key={item.id}
              className={`quick-drop-toggle ${selected ? "selected" : ""}`}
              aria-pressed={selected}
              aria-label={`${item.name} 획득`}
              title={
                locked
                  ? "정산·사용 기록은 상세에서 먼저 취소해 주세요."
                  : item.name
              }
              disabled={busy || locked || completion.excluded}
              onClick={() =>
                cmd.mutate({
                  type: "drop",
                  completionId: completion.id,
                  itemId: item.id,
                  quantity: selected ? 0 : 1,
                })
              }
            >
              <ItemIcon image={item.image} kind={item.icon} small />
              <span>
                <strong>{item.name}</strong>
                <small>
                  {item.price === null ? "가격 미정" : formatMeso(item.price)}
                </small>
              </span>
              <span className="quick-check" aria-hidden="true">
                {selected && <Check size={12} />}
              </span>
            </button>
          );
        })}
        {!items.length && (
          <span className="muted-note">
            등록된 주요 드랍이 없어요. 상세에서 추가할 수 있어요.
          </span>
        )}
      </div>
      <button
        className="quick-none"
        aria-pressed={completion.review === "none"}
        disabled={busy || selectedCount > 0 || completion.excluded}
        onClick={() =>
          cmd.mutate({
            type: "review",
            id: completion.id,
            value: completion.review === "none" ? "pending" : "none",
          })
        }
      >
        {completion.review === "none" ? (
          <>
            <Check size={13} />
            드랍 없음 확인
          </>
        ) : (
          "드랍 없음"
        )}
      </button>
    </div>
  );
}
