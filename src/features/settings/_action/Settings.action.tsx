"use client";
import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Upload, ShieldCheck, ExternalLink } from "lucide-react";
import { useBook } from "@/shared/_state/useBook";
import { useAppState } from "@/shared/_state/useAppState";
import { useCommand } from "@/shared/_action/useCommand";
import { api } from "@/shared/_lib/api";
import { Avatar } from "@/shared/_component/Visual";
import { Loading, ErrorState } from "@/shared/_component/Status";
import { useRouter } from "next/navigation";
export default function SettingsAction() {
  const q = useBook();
  const router = useRouter();
  const cmd = useCommand();
  const query = useQueryClient();
  const { mode, notify } = useAppState();
  const [preview, setPreview] = useState<{
    token: string;
    characters: number;
    completions: number;
    drops: number;
    settlements: number;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState("");
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const { book } = q.data;
  const importFile = async (file: File) => {
    setBusy(true);
    try {
      if (file.size > 10000000)
        throw new Error("10MB 이하의 백업을 선택해 주세요.");
      setPreview(
        await api(`import/preview?mode=${mode}`, JSON.parse(await file.text())),
      );
    } catch (e) {
      notify(e instanceof Error ? e.message : "복원 미리보기에 실패했어요.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">PREFERENCES</div>
          <h1>설정</h1>
          <p>나의 플레이에 맞게 가계부를 정리하세요.</p>
        </div>
      </div>
      <section className="panel settings-section">
        <h2>
          <ShieldCheck size={22} />
          계정 연결
        </h2>
        <div className="setting-line">
          <div>
            <strong>본인 API 키 연결됨</strong>
            <p>키는 암호화되어 저장되며 화면에 다시 표시하지 않아요.</p>
          </div>
          <Link className="button" href="/setup">
            연결 설정
          </Link>
        </div>
        <button
          className="text-button danger-text"
          disabled={busy}
          onClick={async () => {
            if (
              !window.confirm(
                "API 키 연결을 해제할까요? 기존 장부는 유지하고 키 입력 화면으로 돌아가요.",
              )
            )
              return;
            setBusy(true);
            try {
              await api("connection/disconnect", {});
              query.clear();
              router.replace("/setup");
              router.refresh();
            } catch (e) {
              notify((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          연결 해제
        </button>
      </section>
      <section className="panel settings-section">
        <h2>관리 캐릭터</h2>
        {book.characters.map((c) => (
          <div className="setting-character" key={c.id}>
            <Avatar image={c.image} variant={c.avatar} size={46} />
            <div className="row-body">
              <strong>{c.name}</strong>
              <p>
                {c.world} · {c.job}
              </p>
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={c.favorite}
                disabled={cmd.isPending}
                onChange={(e) =>
                  cmd.mutate({
                    type: "character",
                    id: c.id,
                    managed: c.managed,
                    favorite: e.target.checked,
                    order: c.order,
                  })
                }
              />
              즐겨찾기
            </label>
            <label className="order-input">
              <span className="sr-only">{c.name} 표시 순서</span>
              <input
                type="number"
                min="0"
                max="99"
                defaultValue={c.order}
                onBlur={(e) => {
                  if (Number(e.target.value) !== c.order)
                    cmd.mutate({
                      type: "character",
                      id: c.id,
                      managed: c.managed,
                      favorite: c.favorite,
                      order: Number(e.target.value),
                    });
                }}
              />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={c.managed}
                disabled={cmd.isPending}
                onChange={(e) =>
                  cmd.mutate({
                    type: "character",
                    id: c.id,
                    managed: e.target.checked,
                    favorite: c.favorite,
                    order: c.order,
                  })
                }
              />
              관리
            </label>
          </div>
        ))}
        {!book.characters.length && (
          <p className="muted-note">연결된 캐릭터가 없어요.</p>
        )}
      </section>
      <section className="panel settings-section">
        <div className="section-heading">
          <h2>보스 계획</h2>
          <label>
            <span className="sr-only">계획 캐릭터</span>
            <select
              value={
                selected ||
                book.characters.find(
                  (c) =>
                    c.managed && book.plans.some((p) => p.characterId === c.id),
                )?.id ||
                ""
              }
              onChange={(e) => setSelected(e.target.value)}
            >
              {book.characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {book.plans
          .filter(
            (p) =>
              p.characterId ===
              (selected ||
                book.characters.find(
                  (c) =>
                    c.managed && book.plans.some((p) => p.characterId === c.id),
                )?.id),
          )
          .map((p) => {
            const b = book.bosses.find((b) => b.id === p.bossId)!;
            return (
              <div className="plan-row" key={p.id}>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={p.enabled}
                    disabled={cmd.isPending}
                    onChange={(e) =>
                      cmd.mutate({
                        type: "plan",
                        id: p.id,
                        enabled: e.target.checked,
                        party: 1,
                        difficulty: p.difficulty,
                      })
                    }
                  />
                  {b.name}
                </label>
                <label>
                  <span className="sr-only">{b.name} 난이도</span>
                  <select
                    disabled={cmd.isPending}
                    value={p.difficulty ?? ""}
                    onChange={(e) =>
                      cmd.mutate({
                        type: "plan",
                        id: p.id,
                        enabled: p.enabled,
                        party: 1,
                        difficulty: e.target.value || null,
                      })
                    }
                  >
                    <option value="">나중에 설정</option>
                    {book.bosses
                      .filter((x) => x.group === b.group)
                      .map((x) => (
                        <option key={x.id} value={x.difficulty}>
                          {x.difficulty}
                        </option>
                      ))}
                  </select>
                </label>
                <span className="solo-caption">1인 기준</span>
              </div>
            );
          })}
        <p className="muted-note">
          새 완료 기록부터 적용해요. 기존 기록의 계산 스냅샷은 유지돼요.
        </p>
      </section>
      <section className="panel settings-section">
        <h2>조회와 가격 정책</h2>
        <form
          className="inline-form"
          key={book.settings.dailyBudget + "-" + book.settings.staleHours}
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            cmd.mutate(
              {
                type: "settings",
                dailyBudget: Number(f.get("budget")),
                staleHours: Number(f.get("stale")),
              },
              { onSuccess: () => notify("정책을 저장했어요.") },
            );
          }}
        >
          <label>
            앱 내부 24시간 호출 예산
            <input
              name="budget"
              type="number"
              min="1"
              max="800"
              defaultValue={book.settings.dailyBudget}
            />
          </label>
          <label>
            기준가 신선도 (시간)
            <input
              name="stale"
              type="number"
              min="1"
              max="720"
              defaultValue={book.settings.staleHours}
            />
          </label>
          <button className="button" disabled={cmd.isPending}>
            정책 저장
          </button>
        </form>
        <p className="muted-note">
          앱 관측 사용량 {q.data.usage}회 · 다른 프로그램의 사용량은 알 수
          없어요. 실제 동기화는 미지원 상태예요.
        </p>
        <p className="muted-note">
          워커{" "}
          {book.sync.workerSeen
            ? `마지막 실행: ${new Date(book.sync.workerSeen).toLocaleString("ko-KR")}`
            : "미실행"}{" "}
          · 브라우저를 닫은 동안 실제 보스 추적은 아직 지원하지 않아요.
        </p>
      </section>
      <section className="panel settings-section">
        <h2>데이터 백업과 복원</h2>
        <div className="button-row">
          <a className="button" href={`/api/export?mode=${mode}`}>
            <Download size={16} />
            JSON 백업
          </a>
          <a className="button" href={`/api/export?mode=${mode}&format=csv`}>
            <Download size={16} />
            CSV 내보내기
          </a>
          <label className="button">
            <Upload size={16} />
            {busy ? "검증 중…" : "백업 불러오기"}
            <input
              className="sr-only"
              type="file"
              accept=".json,application/json"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importFile(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        {preview && (
          <div className="notice warning">
            <div>
              <strong>복원 미리보기</strong>
              <p>
                캐릭터 {preview.characters}개 · 완료 {preview.completions}건 ·
                드랍 {preview.drops}건
              </p>
              <p>현재 장부를 백업 내용으로 교체해요.</p>
              <button
                className="button primary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await api(`import/commit?mode=${mode}`, {
                      token: preview.token,
                      confirm: true,
                    });
                    setPreview(null);
                    await query.invalidateQueries({ queryKey: ["book"] });
                    notify("백업을 복원했어요.");
                  } catch (e) {
                    notify((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                이 내용으로 복원
              </button>
              <button className="text-button" onClick={() => setPreview(null)}>
                취소
              </button>
            </div>
          </div>
        )}
        <p className="muted-note">
          백업에는 API 키·세션이 포함되지 않아요. 복원은 검증·미리보기 후 한
          번에 적용돼요.
        </p>
        <button
          className="text-button danger-text"
          disabled={busy}
          onClick={async () => {
            if (
              window.prompt(
                `$ 장부의 완료 ${book.completions.length}건, 드랍 ${book.drops.length}건을 삭제합니다. 계속하려면 ‘장부 삭제’를 입력하세요.`,
              ) !== "장부 삭제"
            )
              return;
            setBusy(true);
            try {
              await api(`delete?mode=${mode}`, {
                confirm: "장부 삭제",
                revision: book.revision,
              });
              await query.invalidateQueries({ queryKey: ["book"] });
              notify("장부를 삭제했어요.");
            } catch (e) {
              notify((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          장부 삭제
        </button>
      </section>
      <a
        className="text-button"
        href="https://openapi.nexon.com/ko/game/maplestory/?id=57"
        target="_blank"
        rel="noreferrer"
      >
        Data based on NEXON Open API <ExternalLink size={14} />
      </a>
    </>
  );
}
