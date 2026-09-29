"use client";
import { useCommand } from "@/shared/_action/useCommand";
export function ManualItem({ bossId }: { bossId: string }) {
  const cmd = useCommand();
  return (
    <details className="manual-item-form">
      <summary>획득한 아이템 직접 추가</summary>
      <form
        className="detail-form"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const f = new FormData(form);
          cmd.mutate(
            {
              type: "item-create",
              bossId,
              name: String(f.get("name")),
              price: String(f.get("price")) || null,
              tradable: f.get("tradable") === "on",
              market: String(f.get("market")),
              variant: String(f.get("variant")),
            },
            { onSuccess: () => form.reset() },
          );
        }}
      >
        <p className="muted-note">
          한 번 등록하면 이 보스의 드랍 후보에 저장돼요. 실제 획득 여부는 등록
          후 선택해 주세요.
        </p>
        <label>
          아이템 이름
          <input
            name="name"
            required
            maxLength={100}
            placeholder="획득한 아이템 이름"
          />
        </label>
        <label>
          기준 단가 (메소, 비우면 미정)
          <input name="price" inputMode="numeric" pattern="[0-9]*" />
        </label>
        <label>
          비교 시장
          <input name="market" required maxLength={80} defaultValue="내 월드" />
        </label>
        <label>
          옵션·거래 조건
          <input
            name="variant"
            maxLength={160}
            placeholder="기본 옵션, 교환 가능 횟수 등"
          />
        </label>
        <label className="checkbox-label">
          <input type="checkbox" name="tradable" defaultChecked />
          거래 가능
        </label>
        <button className="button soft" disabled={cmd.isPending}>
          드랍 후보 추가
        </button>
        {cmd.isError && (
          <p role="alert" className="field-error">
            {cmd.error.message}
          </p>
        )}
      </form>
    </details>
  );
}
