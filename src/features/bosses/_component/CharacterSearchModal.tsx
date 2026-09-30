"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
export function CharacterSearchModal({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    dialog?.querySelector("input")?.focus();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="character-search-modal"
      aria-label="다른 캐릭터 검색"
      onCancel={(event) => {
        event.preventDefault();
        router.back();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          router.back();
      }}
    >
      <button
        className="icon-button character-search-close"
        aria-label="캐릭터 검색 닫기"
        onClick={() => router.back()}
      >
        <X size={20} />
      </button>
      {children}
    </dialog>
  );
}
