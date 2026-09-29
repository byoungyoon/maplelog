"use client";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  EyeOff,
  ArrowRight,
  LockKeyhole,
  Check,
  ExternalLink,
} from "lucide-react";
import { useBook } from "@/shared/_state/useBook";
import { useCommand } from "@/shared/_action/useCommand";
import { api } from "@/shared/_lib/api";
import { Avatar } from "@/shared/_component/Visual";
import { useConnection } from "../_state/useConnection";
export default function SetupAction() {
  const connection = useConnection();
  const { data, error } = useBook(connection.data?.connected === true);
  const cmd = useCommand(connection.data?.connected === true);
  const router = useRouter();
  const query = useQueryClient();
  const [step, setStep] = useState(0);
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <div className="setup-card">
      <div className="setup-brand">
        <Image
          src="/brand/icon-sage.png"
          alt="메소로그"
          width={76}
          height={76}
          priority
        />
      </div>
      <div className="setup-steps">
        {["키 연결", "캐릭터 선택", "기록 시작"].map((x, i) => (
          <span key={x} className={i === step ? "active" : ""}>
            {i < step ? <Check size={14} /> : i + 1} {x}
          </span>
        ))}
      </div>
      <h1>
        {step === 0
          ? "내 보스 기록을\n자동으로 모아볼까요?"
          : step === 1
            ? "기록할 캐릭터를 골라요"
            : "나의 장부를 시작해요"}
      </h1>
      <p>
        {step === 0
          ? "본인 Nexon API 키를 연결하면 계정의 캐릭터 목록을 불러와요."
          : step === 1
            ? "수익을 관리할 캐릭터만 선택해 주세요."
            : "실제 계정에 연결된 캐릭터만 기록해요."}
      </p>
      {step === 0 ? (
        <>
          <form
            className="detail-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setMessage("");
              try {
                await api("connection/verify", { key });
                setKey("");
                await query.invalidateQueries({ queryKey: ["connection"] });
                await query.invalidateQueries({ queryKey: ["book"] });
                setStep(1);
              } catch (e) {
                setMessage((e as Error).message);
              } finally {
                setKey("");
                setBusy(false);
              }
            }}
          >
            <label>
              본인 Nexon API 키
              <div className="key-input">
                <LockKeyhole size={18} />
                <input
                  type={showKey ? "text" : "password"}
                  autoComplete="off"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="본인 API 키를 입력해 주세요"
                  required
                  aria-describedby="key-help"
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={showKey ? "API 키 숨기기" : "API 키 표시"}
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            <p id="key-help" className="muted-note">
              키는 서버에서 확인한 뒤 암호화해 저장해요. 브라우저에는 저장하지
              않아요.
            </p>
            {message && (
              <div className="notice warning" role="alert">
                {message}
              </div>
            )}
            <button
              className="button primary full"
              disabled={busy || !key.trim() || connection.isPending}
            >
              {busy
                ? "넥슨에서 키 확인 중…"
                : connection.data?.connected
                  ? "새 키 확인하고 연결"
                  : "키 확인하고 시작하기"}
              <ArrowRight size={16} />
            </button>
          </form>
          {connection.data?.connected && (
            <div className="notice">
              <div>
                <strong>이미 확인된 API 키가 연결되어 있어요.</strong>
                <p>키는 다시 표시하지 않아요.</p>
                <button className="button" onClick={() => setStep(1)}>
                  연결된 캐릭터 선택
                </button>
              </div>
            </div>
          )}
          <details className="key-guide">
            <summary>API 키는 어디서 발급하나요?</summary>
            <ol>
              <li>넥슨 Open API에 본인 계정으로 로그인해 주세요.</li>
              <li>
                애플리케이션을 등록하고 게임을 메이플스토리로 선택해 주세요.
              </li>
              <li>발급된 API 키를 복사해 위 입력란에 붙여넣으세요.</li>
            </ol>
            <p>본인 계정으로 로그인해 주세요.</p>
          </details>
          <a
            className="text-button key-issue"
            href="https://openapi.nexon.com/ko/guide/prepare-in-advance/"
            target="_blank"
            rel="noreferrer"
          >
            Nexon Open API에서 키 발급하기
            <ExternalLink size={14} />
          </a>
        </>
      ) : step === 1 ? (
        <>
          <div className="setup-characters">
            {data?.book.characters.map((c) => (
              <label key={c.id}>
                <Avatar image={c.image} variant={c.avatar} size={50} />
                <span>
                  <strong>{c.name}</strong>
                  <small>
                    {c.world} · {c.job} · Lv. {c.level}
                  </small>
                </span>
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
              </label>
            ))}
          </div>
          {data?.book.characters.length === 0 && (
            <div className="notice">
              이 계정에서 조회된 캐릭터가 없어요. 캐릭터를 만든 뒤 다시 연결해
              주세요.
            </div>
          )}
          <button
            className="button primary full"
            onClick={() => setStep(2)}
            disabled={
              cmd.isPending || !data?.book.characters.some((c) => c.managed)
            }
          >
            선택 완료
          </button>
        </>
      ) : (
        <>
          <div className="notice">
            관리 캐릭터 {data?.book.characters.filter((c) => c.managed).length}
            개<br />
            본인 API 키 연결을 확인했어요.
          </div>
          <p className="muted-note">
            보스 스케줄러를 조회해 완료 상태를 가져와요. 드랍·결정석 판매액과
            파티 인원은 직접 확인해 주세요.
          </p>
          <button
            className="button primary full"
            disabled={cmd.isPending}
            onClick={() =>
              cmd.mutate(
                { type: "setup" },
                {
                  onSuccess: () => {
                    void api("sync/request", {})
                      .finally(() =>
                        query.invalidateQueries({ queryKey: ["book"] }),
                      )
                      .catch(() => {});
                    router.replace("/");
                    router.refresh();
                  },
                },
              )
            }
          >
            내 장부 시작하기
            <ArrowRight size={16} />
          </button>
        </>
      )}
      {(error || connection.error) && (
        <p className="field-error">
          {error?.message || connection.error?.message}
        </p>
      )}
      <div className="setup-privacy">
        본인 계정만 관리하는 개인용 장부예요.
        <br />키 연결을 완료해야 장부를 사용할 수 있어요.
      </div>
    </div>
  );
}
