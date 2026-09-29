# 화면 구조

참조: `/Users/byoungyoonlee/Desktop/batch/re-qu-test/src/Pages/clinic`의 page.tsx, `_area/Table.area.tsx`, `_action/SelectRegion.action.tsx`, `_state/useClinicList.ts`, `_lib/getClinicWrongPaper.ts`.

App Router의 page.tsx는 영역 조합만 담당한다. 기능별 디렉터리는 `src/features/<feature>` 아래에 둔다.

- `_area`: 화면의 의미 있는 영역, action과 component 조합
- `_action`: 사용자 이벤트와 mutation을 연결하는 컴포넌트·훅. Next 서버 액션과는 별개 명칭
- `_state`: TanStack Query 조회 훅과 Zustand UI store
- `_lib`: HTTP 접근과 순수 변환
- `_component`: props를 받아 그리는 표시 컴포넌트

공통 영역은 `src/shared`에 같은 패턴을 사용한다. 서버 데이터·계산 합계는 Zustand에 복제하지 않는다. 서버 도메인은 `src/domain`, 영속 저장·인증은 `src/server`로 분리한다.
