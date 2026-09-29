"use client";
import { usePriceImport } from "../_state/usePriceImport";
import { useState } from "react";
import { Search, PenLine, Info } from "lucide-react";
import { useBook } from "@/shared/_state/useBook";
import { useCommand } from "@/shared/_action/useCommand";
import { useAppState } from "@/shared/_state/useAppState";
import { Loading, ErrorState, Empty } from "@/shared/_component/Status";
import { ItemIcon } from "@/shared/_component/Visual";
import { Sheet } from "@/shared/_component/Sheet";
import { formatMeso } from "@/domain/money";
import type { Item } from "@/domain/model";
export default function PricesAction() {
  const q = useBook();
  const priceImport = usePriceImport();
  const cmd = useCommand();
  const { notify } = useAppState();
  const [search, setSearch] = useState("");
  const [edit, setEdit] = useState<Item | null>(null);
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const { book } = q.data;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">PRICE BOOK</div>
          <h1>나의 기준 시세</h1>
          <p>자주 기록하는 아이템의 가격을 관리하세요.</p>
        </div>
        <span className="outlined-badge">자동 연동 미연결</span>
      </div>
      <div className="notice">
        <Info size={17} />
        <span>
          수동 기준가는 새 획득 기록에 적용돼요. 기존 기록과 실제 정산액은
          바뀌지 않아요.
        </span>
      </div>
      <details className="audit-details">
        <summary>사용자 가격 데이터 가져오기</summary>
        <p>
          JSON 배열에 id, price(메소 정수 문자열 또는 null), market, variant를
          넣어 주세요. 같은 아이템 ID의 기준가를 한 번에 수정해요.
        </p>
        <pre className="import-example">
          {JSON.stringify(
            [
              {
                id: "아이템 ID",
                price: "55000000",
                market: "비교 시장",
                variant: "기본 · 교환 가능",
              },
            ],
            null,
            2,
          )}
        </pre>
        <label className="button">
          {priceImport.busy ? "가져오는 중…" : "가격 JSON 선택"}
          <input
            type="file"
            accept="application/json,.json"
            className="sr-only"
            disabled={priceImport.busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void priceImport.importFile(file);
              e.target.value = "";
            }}
          />
        </label>
      </details>
      <label className="search-input">
        <Search size={18} />
        <input
          placeholder="아이템 이름 검색"
          aria-label="아이템 이름 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <section className="panel prices-list">
        {book.items
          .filter((i) => i.name.includes(search))
          .map((i) => {
            const stale =
              new Date(i.observedAt).getTime() <
              q.data.asOf - book.settings.staleHours * 3600000;
            return (
              <div className="price-row" key={i.id}>
                <ItemIcon image={i.image} kind={i.icon} />
                <div className="row-body">
                  <strong>{i.name}</strong>
                  <p>
                    {i.market} · {i.variant}
                  </p>
                  <span className="price-meta">
                    {i.source === "scouter"
                      ? "메이플스카우터 후보 · 단가 미정"
                      : "수동 기준가"}{" "}
                    ·{" "}
                    {new Date(i.observedAt).toLocaleString("ko-KR", {
                      timeZone: "Asia/Seoul",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="price-value">
                  <strong>
                    {formatMeso(i.price)}
                    {i.price && <small> 메소</small>}
                  </strong>
                  <span className={`price-state ${stale ? "stale" : ""}`}>
                    {i.price === null
                      ? "미정"
                      : stale
                        ? "오래된 기준가"
                        : "기준가 있음"}
                  </span>
                </div>
                <button
                  className="icon-button"
                  aria-label={`${i.name} 기준가 수정`}
                  onClick={() => setEdit({ ...i })}
                >
                  <PenLine size={18} />
                </button>
              </div>
            );
          })}
        {!book.items.length && (
          <Empty
            title="등록된 아이템이 없어요"
            detail="보스의 드랍 기록에서 아이템을 직접 추가하면 여기서 기준가를 관리할 수 있어요."
          />
        )}
      </section>
      <details className="audit-details">
        <summary>결정석 기준가 관리</summary>
        <p className="muted-note">
          <a
            href="https://maplescouter.com/ko/boss-income"
            target="_blank"
            rel="noreferrer"
          >
            출처: 메이플스카우터
          </a>{" "}
          · 확인 2026.09.29 · 검은 마법사 변경가는 10.01 적용
        </p>
        <p className="muted-note">
          메이플스카우터의 9월 17일 가격표를 적용했어요. 직접 수정한 기준가는 새
          완료 기록부터 적용되며, 기존 기록은 드랍 기록의 조건 확인에서 반영할
          수 있어요.
        </p>
        {book.bosses.map((b) => (
          <form
            key={b.id}
            className="price-row"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              cmd.mutate({
                type: "crystal-price",
                bossId: b.id,
                price: String(f.get("price")) || null,
              });
            }}
          >
            <div className="row-body">
              <strong>{b.name}</strong>
              <p>
                {b.difficulty} ·{" "}
                {b.cycle === "weekly"
                  ? "주간"
                  : b.cycle === "daily"
                    ? "일간"
                    : "월간"}
              </p>
            </div>
            <label>
              <span className="sr-only">
                {b.name} {b.difficulty} 결정석 기준가
              </span>
              <input
                key={b.crystal}
                name="price"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="기준가 미정"
                defaultValue={b.crystal ?? ""}
                style={{ width: 150 }}
              />
            </label>
            <button className="button soft" disabled={cmd.isPending}>
              저장
            </button>
          </form>
        ))}
      </details>
      <p className="muted-note mt-6">
        시세 자동 연동은 미연결 상태예요. 확인한 기준가를 직접 관리할 수 있어요.
      </p>
      {edit && (
        <Sheet
          title="기준가 수정"
          onClose={() => {
            if (
              window.confirm(
                "기준가 편집을 닫을까요? 저장하지 않은 값은 사라져요.",
              )
            )
              setEdit(null);
          }}
          busy={cmd.isPending}
        >
          <div className="sheet-content">
            <h2>{edit.name}</h2>
            <p className="sheet-description">
              비교 조건이 같은 아이템의 기준가를 입력하세요.
            </p>
            <form
              className="detail-form"
              onSubmit={(e) => {
                e.preventDefault();
                cmd.mutate(
                  {
                    type: "price",
                    id: edit.id,
                    price: edit.price,
                    market: edit.market,
                    variant: edit.variant,
                  },
                  {
                    onSuccess: () => {
                      setEdit(null);
                      notify(
                        "기준가를 저장했어요. 기존 평가 스냅샷은 유지돼요.",
                      );
                    },
                  },
                );
              }}
            >
              <label>
                단가 (메소, 비우면 미정)
                <input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={edit.price ?? ""}
                  onChange={(e) =>
                    setEdit({ ...edit, price: e.target.value || null })
                  }
                />
              </label>
              <label>
                비교 시장
                <input
                  value={edit.market}
                  required
                  onChange={(e) => setEdit({ ...edit, market: e.target.value })}
                />
              </label>
              <label>
                옵션·거래 조건
                <input
                  value={edit.variant}
                  onChange={(e) =>
                    setEdit({ ...edit, variant: e.target.value })
                  }
                />
              </label>
              <div className="notice">
                가격 0과 가격 미정은 달라요. 시세를 모르면 빈칸으로 두세요.
              </div>
              {cmd.isError && (
                <p className="field-error">{cmd.error.message}</p>
              )}
              <button className="button primary full" disabled={cmd.isPending}>
                기준가 저장
              </button>
            </form>
          </div>
        </Sheet>
      )}
    </>
  );
}
