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
  ExternalLink,
} from "lucide-react";
import { api } from "@/shared/_lib/api";
import { useConnection } from "../_state/useConnection";
export default function SetupAction() {
  const connection = useConnection();
  const router = useRouter();
  const query = useQueryClient();
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
      <h1>
        내 보스 기록을
        <br />
        자동으로 모아볼까요?
      </h1>
      <p>키를 연결한 뒤 보스 화면에서 캐릭터 이름을 검색해 조회하세요.</p>
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
            router.replace("/bosses");
            router.refresh();
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
            <button className="button" onClick={() => router.push("/bosses")}>
              보스 화면 열기
            </button>
          </div>
        </div>
      )}
      <details className="key-guide">
        <summary>API 키는 어디서 발급하나요?</summary>
        <ol>
          <li>넥슨 Open API에 본인 계정으로 로그인해 주세요.</li>
          <li>애플리케이션을 등록하고 게임을 메이플스토리로 선택해 주세요.</li>
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
      {connection.error && (
        <p className="field-error">{connection.error.message}</p>
      )}
      <div className="setup-privacy">
        본인 계정만 관리하는 개인용 장부예요.
        <br />키 연결을 완료해야 장부를 사용할 수 있어요.
      </div>
    </div>
  );
}
