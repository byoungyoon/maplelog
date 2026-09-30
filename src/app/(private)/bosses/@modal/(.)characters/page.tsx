import CharacterSearchAction from "@/features/bosses/_action/CharacterSearch.action";
import { CharacterSearchModal } from "@/features/bosses/_component/CharacterSearchModal";
export default function Page() {
  return (
    <CharacterSearchModal>
      <CharacterSearchAction />
    </CharacterSearchModal>
  );
}
