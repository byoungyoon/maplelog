"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/_lib/api";
export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const q = useQueryClient();
  return (
    <section className="setup-area">
      <div className="setup-card">
        <h1>내 장부에 로그인</h1>
        <p>설치할 때 설정한 소유자 비밀번호를 입력하세요.</p>
        <form
          className="detail-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await api("auth/login", { password });
              setPassword("");
              await q.invalidateQueries({ queryKey: ["book"] });
              router.push("/");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            소유자 비밀번호
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          <button className="button primary full" disabled={busy}>
            {busy ? "로그인 중…" : "로그인"}
          </button>
        </form>
      </div>
    </section>
  );
}
