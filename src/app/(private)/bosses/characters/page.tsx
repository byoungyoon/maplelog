import Link from "next/link";
import CharacterSearchAction from "@/features/bosses/_action/CharacterSearch.action";
export default function Page() {
  return (
    <section className="page boss-character-search-page">
      <Link className="button" href="/bosses">
        보스로 돌아가기
      </Link>
      <div className="panel boss-character-search-panel">
        <CharacterSearchAction />
      </div>
    </section>
  );
}
