"use client";
import Link from "next/link";
import { AlertCircle, LoaderCircle } from "lucide-react";
import { ApiError } from "../_lib/api";
export function Loading() {
  return (
    <div className="empty">
      <LoaderCircle className="animate-spin" size={28} />
      <p>장부를 불러오고 있어요</p>
    </div>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: Error;
  retry: () => void;
}) {
  return (
    <div className="empty">
      <AlertCircle size={30} />
      <h2>잠시 확인이 필요해요</h2>
      <p>{error.message}</p>
      {error instanceof ApiError &&
      (error.status === 401 || error.status === 428) ? (
        <Link
          className="button primary"
          href={error.status === 428 ? "/setup" : "/login"}
        >
          {error.status === 428 ? "API 키 연결" : "소유자 로그인"}
        </Link>
      ) : (
        <button className="button" onClick={retry}>
          다시 시도
        </button>
      )}
    </div>
  );
}
export function Empty({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="empty">
      <span className="empty-symbol">✓</span>
      <h3>{title}</h3>
      {detail && <p>{detail}</p>}
    </div>
  );
}
