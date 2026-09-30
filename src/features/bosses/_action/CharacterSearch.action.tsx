"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import type { Character } from "@/domain/model";
import { useBook } from "@/shared/_state/useBook";
import { useAppState } from "@/shared/_state/useAppState";
import { Avatar } from "@/shared/_component/Visual";
import { Loading, ErrorState } from "@/shared/_component/Status";
import { api } from "@/shared/_lib/api";
export default function CharacterSearchAction() {
  const q = useBook(true, true);
  const router = useRouter();
  const params = useSearchParams();
  const notify = useAppState((state) => state.notify);
  const [search, setSearch] = useState("");
  const [searchingId, setSearchingId] = useState<string | null>(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const lookupCharacter = async (character: Character) => {
    setSearchingId(character.id);
    try {
      if (
        !q.data?.book.sync.characters?.some(
          (state) =>
            state.characterId === character.id && state.status !== "error",
        )
      ) {
        const result = await api<{ coalesced: boolean; failed: number }>(
          "sync/request",
          { characterId: character.id },
        );
        await q.refetch();
        if (!active.current) return;
        if (result.failed)
          notify("보스 조회에 실패했어요. 조회 상태를 확인해 주세요.");
        else if (result.coalesced)
          notify("다른 보스 조회가 진행 중이에요. 잠시 뒤 다시 조회해 주세요.");
      }
      if (active.current)
        router.replace(
          `/bosses?${new URLSearchParams({ character: character.id })}`,
          { scroll: false },
        );
    } catch (error) {
      if (active.current)
        notify(
          error instanceof Error ? error.message : "보스 조회에 실패했어요.",
        );
    } finally {
      if (active.current) setSearchingId(null);
    }
  };
  if (q.isPending) return <Loading />;
  if (q.error) return <ErrorState error={q.error} retry={() => q.refetch()} />;
  const term = search.trim().toLocaleLowerCase();
  const characters = q.data.book.characters.filter((c) =>
    c.name.toLocaleLowerCase().includes(term),
  );
  return (
    <div className="character-search-content">
      <h2>캐릭터 검색</h2>
      <p>보스 현황을 확인할 캐릭터를 선택하세요.</p>
      <label className="search-input">
        <Search size={18} />
        <input
          autoFocus
          aria-label="캐릭터 검색"
          placeholder="캐릭터 이름 검색"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <div className="character-search-results" aria-label="캐릭터 검색 결과">
        {characters.map((character) => (
          <div className="boss-character-result" key={character.id}>
            <Avatar
              image={character.image}
              variant={character.avatar}
              size={48}
            />
            <span>
              <strong>{character.name}</strong>
              <small>
                {character.world} · {character.job} · Lv. {character.level}
                {params.get("character") === character.id && " · 선택됨"}
              </small>
            </span>
            <button
              className="button"
              disabled={searchingId !== null}
              onClick={() => void lookupCharacter(character)}
            >
              {searchingId === character.id
                ? "조회 중…"
                : q.data.book.sync.characters?.some(
                      (state) =>
                        state.characterId === character.id &&
                        state.status !== "error",
                    )
                  ? "상세보기"
                  : "보스 조회"}
            </button>
          </div>
        ))}
        {!characters.length && (
          <p className="character-search-empty">
            {q.data.book.characters.length
              ? "검색한 캐릭터가 없어요."
              : "연결된 캐릭터가 없어요."}
          </p>
        )}
      </div>
    </div>
  );
}
